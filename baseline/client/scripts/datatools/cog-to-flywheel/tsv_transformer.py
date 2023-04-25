# TODO deal with failed image preloads

from abc import ABC, abstractmethod

def transformer_for_task(task, data, subject):
    if task == 'task-moodPrediction':
        return MoodPrediction(data, subject, task)
    elif task == 'task-panas':
        return Panas(data, subject, task)
    elif task == 'task-physicalActivity':
        return PhysicalActivity(data, subject, task)
    elif task == 'task-faceName':
        return FaceName(data, subject, task)
    
    raise NotImplementedError

class TsvTransfomer(ABC):
    default_fields = ['date_time', 'is_relevant', 'screen_size', 'time_elapsed', 'ua', 'version']
    def __init__(self, data, subject, task):
        self.data = data
        self.subject = subject
        self.task = task
        self.runs = []
        self.has_multi_runs = False
        self.fieldnames = []

    def _skip(self, line):
        if line["results"].get('trial_type', '') == 'fullscreen': 
            return True
        stimulus = line['results'].get('stimulus', '')
        if not line.get('isRelevant', True) and ('You are about to start set' in stimulus or 'You have completed' in stimulus):
            return True
        return False
    
    @abstractmethod
    def _process_line(self, line):
        res = line['results']
        if res.get('taskStarted', None):
            rd = RunData(res['setNum'])
            self.runs.append(rd)
            return (rd, 'START', {})
        elif res.get('ua', None): # This marks the end of a given task run
            rd = self.runs[-1]
            rd.finalize(res['ua'], res['v'], res['screen'])
            return(rd, 'END', {'ua': res['ua'], 'version': res['v'], 'screen_size': res['screen']})
        
        # if not line.get('experimentDateTime', None): print(f'no dateTime: {line}')
        rd = self.runs[-1]
        date_time = line['experimentDateTime'].split('|')[1]
        return (rd, 'NORMAL', {'is_relevant': line['isRelevant'], 'time_elapsed': res['time_elapsed'], 'date_time': date_time})

    def _write_results(self):
        import csv
        csv.register_dialect('tabs', delimiter='\t')
        files_written = []

        for idx, run_data in enumerate(self.runs):
            fname = f'sub-{self.subject}_ses-{run_data.get_session()}_{self.task}'
            if self.has_multi_runs:
                fname += f'_run-{idx+1}'
            fname += '_beh.tsv'
            with open(fname, 'w') as f:
                writer = csv.DictWriter(f, [*self.default_fields, *self.fieldnames], dialect='tabs')
                writer.writeheader()
                writer.writerows(run_data.get_lines())
                files_written.append(fname)

        return files_written

    def process(self):
        for line in self.data:
            if not self._skip(line):
                self._process_line(line)

        files_written = self._write_results()
        return files_written

# Encapsulates all of the data for a given run of a given task
class RunData(object):
    def __init__(self, set_num):
        self._set_num = set_num
        self._lines = []
        self._frozen = False
        self._ua = None
        self._version = None
        self._screen_size = None

    def add_line(self, line):
        if self._frozen: raise AssertionError(f'run data may not be changed after they have been finalized')
        self._lines.append(line)

    def get_lines(self):
        return self._lines

    def finalize(self, ua, version, screen_size):
        if self._frozen: raise AssertionError(f'run data has already been finalized')
        # add the user agent, version and screen size fields to all of the existing lines
        for idx, line in enumerate(self._lines):
            line['ua'] = ua
            line['version'] = version
            line['screen_size'] = screen_size
            self._lines[idx] = line
        
        self._frozen = True

    def get_session(self):
        if self._set_num <= 6: return 'pre'
        return 'post'
    

class MoodPrediction(TsvTransfomer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ['preamble', 'bad_mood', 'neutral_mood', 'good_mood']

    def _process_line(self, line):
        (run_data, line_type, fields) = super()._process_line(line)
        if line_type == 'NORMAL':
            res = line['results']
            fields['preamble'] = res['preamble']
            fields['bad_mood'] = res['response']['Bad Mood']
            fields['neutral_mood'] = res['response']['Neutral Mood']
            fields['good_mood'] = res['response']['Good Mood']
            run_data.add_line(fields)


class Panas(TsvTransfomer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ['ashamed', 'upset', 'strong', 'proud', 'excited', 'hostile', 'attentive', 'active', 'inspired', 'distressed', 'enthusiastic', 'guilty', 'irritable', 'alert', 'nervous', 'determined', 'jittery', 'afraid', 'interested', 'scared']
        self.has_multi_runs = True
        
    def _process_line(self, line):
        (run_data, line_type, fields) = super()._process_line(line)
        if line_type == 'NORMAL':
            resp = line['results']['response']
            for field in self.fieldnames:
                fields[field] = resp[field]

            run_data.add_line(fields)

class PhysicalActivity(TsvTransfomer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ["activity_level", "weight", "height_feet", "height_inches", "age", "gender"]

    def _process_line(self, line):
        (run_data, line_type, fields) = super()._process_line(line)
        if line_type == 'NORMAL':
            resp = line['results']['response']
            for field in self.fieldnames:
                fields[field] = resp[field]

            run_data.add_line(fields)

# TODO do we want to share learning and recall together or separately? SEPARATELY
# class PatternSeparationLearning(TsvTransfomer):
#     def __init__(self, data, subject, task):
#         super().__init__(data, subject, task)
#         self.fieldnames = 

class FaceName(TsvTransfomer):
    import re

    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ["trial_index", "stimulus", "response", "category", "is_learning", "is_practice",
                           "is_recall", "name", "names", "pic_id", "lure", "response", "correct", "response_time_ms", "failed_images"]
        self.has_multi_runs = True

    def _process_line(self, line):
        (run_data, line_type, fields) = super()._process_line(line)
        if not line_type == 'NORMAL': return

        res = line['results']
        fields['trial_index'] = res['trial_index']
        if res['trial_type'] == 'preload':
            fields['failed_images'] = res['failed_images']
        else:
            fields['stimulus'] = res['stimulus']
            fields['response'] = res['response']
            fields['response_time_ms'] = res['rt']
            for (orig_field, tsv_field) in zip(
                ['cat', 'correct', 'lure', 'name', 'names', 'picId'],
                ['category', 'correct', 'lure', 'name', 'names', 'pic_id']
                ):
                orig_val = res.get(orig_field, None)
                if orig_val or orig_val is False: # we want to report False for correct
                    fields[tsv_field] = res[orig_field]
                if res.get('picId', None): # then we have a stimulus and want to report False for missing values of certain fields
                    for (orig_bool, tsv_bool) in zip(['isPractice', 'isLearning', 'isRecall'],
                                                     ['is_practice', 'is_learning', 'is_recall']
                                                     ):
                        fields[tsv_bool] = res.get(orig_bool, False)

        run_data.add_line(fields)


    