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
    elif task == 'task-dailyStressors':
        return DailyStressors(data, subject, task)
    elif task == 'task-dass':
        return Dass(data, subject, task)
    elif task == 'task-ffmq':
        return Ffmq(data, subject, task)
    elif task == 'task-patternSeparationLearning':
        return PatternSeparationLearning(data, subject, task)
    elif task == 'task-patternSeparationRecall':
        return PatternSeparationRecall(data, subject, task)
    elif task == 'task-spatialOrientation':
        return SpatialOrientation(data, subject, task)
    elif task == 'task-mindInEyes':
        return MindInEyes(data, subject, task)
    elif task == 'task-verbalFluency':
        return VerbalFluency(data, subject, task)
    elif task == 'task-nBack':
        return NBack(data, subject, task)
    
    raise NotImplementedError

class TsvTransfomer(ABC):
    default_fields = ['date_time', 'is_relevant', 'screen_size', 'time_elapsed_ms', 'ua', 'version']
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
        return (rd, 'NORMAL', {'is_relevant': line['isRelevant'], 'time_elapsed_ms': res['time_elapsed'], 'date_time': date_time})

    def _write_results(self):
        import csv
        csv.register_dialect('tabs', delimiter='\t')
        files_written = []
        pre_session_run_count = 0

        for idx, run_data in enumerate(self.runs):
            fname = f'sub-{self.subject}_ses-{run_data.get_session()}_{self.task}'
            if self.has_multi_runs:
                if run_data.get_session() == 'pre':
                    fname += f'_run-{idx+1}'
                    pre_session_run_count += 1
                else:
                    fname += f'_run-{idx+1 - pre_session_run_count}'
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
    

class SimpleTransfomer(TsvTransfomer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)

    def _process_line(self, line):
        (run_data, line_type, fields) = super()._process_line(line)
        if line_type != 'NORMAL': return

        resp = line['results']['response']
        for field in self.fieldnames:
            fields[field] = resp[field]

        run_data.add_line(fields)

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


class Panas(SimpleTransfomer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ['ashamed', 'upset', 'strong', 'proud', 'excited', 'hostile', 'attentive', 'active', 'inspired', 'distressed', 'enthusiastic', 'guilty', 'irritable', 'alert', 'nervous', 'determined', 'jittery', 'afraid', 'interested', 'scared']
        self.has_multi_runs = True

class PhysicalActivity(SimpleTransfomer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ["activity_level", "weight", "height_feet", "height_inches", "age", "gender"]

class PatternSeparationLearning(TsvTransfomer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ["trial_index", "stimulus", "is_learning", "is_practice",
                           "pic", "type", "response", "response_time_ms", "failed_images"]
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
            
            if res.get('pic', None): 
                fields['pic'] = res['pic']
                fields['type'] = res['type']
                # we have a stimulus and want to report False for missing values of certain fields
                for (orig_bool, tsv_bool) in zip(['isPractice', 'isLearning'],
                                                    ['is_practice', 'is_learning']
                                                    ):
                    fields[tsv_bool] = res.get(orig_bool, False)

        run_data.add_line(fields)

class PatternSeparationRecall(TsvTransfomer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ["trial_index", "stimulus", "is_recall", "pic", "type",
                           "response", "response_time_ms", "failed_images"]
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
            
            if res.get('pic', None): 
                fields['pic'] = res['pic']
                fields['type'] = res['type']
                fields['is_recall'] = res.get('isRecall', False)

        run_data.add_line(fields)

class FaceName(TsvTransfomer):
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


class DailyStressors(SimpleTransfomer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ["Q0", "Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7"]
        self.has_multi_runs = True

class Dass(SimpleTransfomer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ["Q0","Q1","Q2","Q3","Q4","Q5","Q6","Q7","Q8","Q9",
        "Q10","Q11","Q12","Q13","Q14","Q15","Q16","Q17","Q18","Q19","Q20",]

class Ffmq(TsvTransfomer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ["Q0","Q1","Q2","Q3","Q4","Q5","Q6","Q7","Q8","Q9",
        "Q10","Q11","Q12","Q13","Q14"]

    def _process_line(self, line):
        (run_data, line_type, fields) = super()._process_line(line)
        if not line_type == 'NORMAL': return

        q_map = {
            "When I take a shower or a bath, I stay alert to the sensations of water on my body." : 'Q0',
            "I’m good at finding words to describe my feelings." : 'Q1',
            "I don’t pay attention to what I’m doing because I’m daydreaming, worrying, or otherwise distracted." : 'Q2',
            "I believe some of my thoughts are abnormal or bad and I shouldn’t think that way." : 'Q3',
            "When I have distressing thoughts or images, I “step back” and am aware of the thought or image without getting taken over by it." : 'Q4',
            "I notice how foods and drinks affect my thoughts, bodily sensations, and emotions." : 'Q5',
            "I have trouble thinking of the right words to express how I feel about things." : 'Q6',
            "I do jobs or tasks automatically without being aware of what I’m doing." : 'Q7',
            "I think some of my emotions are bad or inappropriate and I shouldn’t feel them." : 'Q8',
            "When I have distressing thoughts or images I am able just to notice them without reacting." : 'Q9',
            "I pay attention to sensations, such as the wind in my hair or the sun on my face." : 'Q10',
            "Even when I’m feeling terribly upset I can find a way to put it into words." : 'Q11',
            "I find myself doing things without paying attention." : 'Q12',
            "I tell myself I shouldn’t be feeling the way I’m feeling." : 'Q13',
            "When I have distressing thoughts or images I just notice them and let them go." : 'Q14'
        }

        resp = line['results']['response']
        for (question, value) in resp.items():
            q_num = q_map[question]
            fields[q_num] = value

        run_data.add_line(fields)

class SpatialOrientation(TsvTransfomer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ['trial_index', 'stimulus', 'mode', 'center', 'facing', 'target',
                           'target_radians', 'response_radians', 'response_time_ms',
                           'signed_radian_distance', 'time_limit_ms', 'completion_reason']
        self.has_multi_runs = True
        
    def _process_line(self, line):
        (run_data, line_type, fields) = super()._process_line(line)
        if not line_type == 'NORMAL': return

        res = line['results']
        if res['trial_type'] == 'call-function': return

        fields['trial_index'] = res['trial_index']
        if not res.get('rt', None):
            print('no rt', line)
        fields['response_time_ms'] = res['rt']
        
        if res.get('stimulus', None): fields['stimulus'] = res['stimulus']
        if res.get('mode', None):
            # then we have an actual trial and can fill in the relevant fields
            fields['mode'] = res['mode']
            fields['center'] = res['center']
            fields['facing'] = res['facing']
            fields['target'] = res['target']
            fields['target_radians'] = res['targetRadians']
            fields['response_radians'] = res['responseRadians']
            fields['signed_radian_distance'] = res['signedRadianDistance']
            fields['time_limit_ms'] = res['timeLimit']
            fields['completion_reason'] = res['completionReason']

        run_data.add_line(fields)

class MindInEyes(TsvTransfomer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ['trial_index', 'is_practice', 'stimulus', 'pic', 'words',
                            'response','response_time_ms', 'failed_images']
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
            fields['is_practice'] = res.get('isPractice', False)
            fields['pic'] = res.get('pic', None)
            fields['words'] = res.get('words', None)

        run_data.add_line(fields)

class VerbalFluency(TsvTransfomer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ['trial_index', 'stimulus', 'letter', 'response']
        self.has_multi_runs = True

    def _process_line(self, line):
        (run_data, line_type, fields) = super()._process_line(line)
        if not line_type == 'NORMAL': return

        res = line['results']
        fields['trial_index'] = res['trial_index']
        fields['stimulus'] = res['stimulus']
        fields['response'] = res['response']
        if res['trial_type'] == 'timed-writing':
            fields['letter'] = res['letter']

        run_data.add_line(fields)

class NBack(TsvTransfomer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ['trial_index', 'stimulus', 'n', 'sequence', 'missed_indices']
        self.has_multi_runs = True

    def add_response(self, fields, response_idx, fieldname, value):
        response_field = f'response_{response_idx}_{fieldname}'
        fields[response_field] = value
        if not response_field in self.fieldnames: self.fieldnames.append(response_field)

    def _process_line(self, line):
        (run_data, line_type, fields) = super()._process_line(line)
        if not line_type == 'NORMAL': return

        res = line['results']
        fields['trial_index'] = res['trial_index']
        fields['stimulus'] = res.get('stimulus', None)
        if res['trial_type'] == 'n-back':
            fields['n'] = res['n']
            fields['sequence'] = res['sequence']
            fields['missed_indices'] = [int(x) for x in res['missedIndices']]
            for (idx, response) in enumerate(res['responses']):
                self.add_response(fields, idx, 'sequence_index', response['index'])
                self.add_response(fields, idx, 'correct', response['correct'])
                self.add_response(fields, idx, 'time_from_focus', response['time_from_focus'])
                self.add_response(fields, idx, 'time_from_start', response['time_from_start'])

        run_data.add_line(fields)

        