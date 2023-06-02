from abc import ABC, abstractmethod

def transformer_for_task(task, data, subject):
    if task == 'task-moodPrediction' or task == 'task-moodMemory':
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
    elif task == 'task-taskSwitching':
        return TaskSwitching(data, subject, task)
    elif task == 'task-flanker':
        return Flanker(data, subject, task)
    elif task == 'task-emotionalMemory':
        return EmotionalMemory(data, subject, task)
    elif task == 'task-sleepSurvey':
        return SleepSurvey(data, subject, task)
    elif task == 'task-verbalLearningLearning':
        return VerbalLearningLearning(data, subject, task)
    elif task == 'task-verbalLearningRecall':
        return VerbalLearningRecall(data, subject, task)
    
    raise NotImplementedError

class TsvTransformer(ABC):
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
        if line['results'].get('trial_type', '') == 'call-function':
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
        return (rd, 'NORMAL', {'is_relevant': line.get('isRelevant', False), 'time_elapsed_ms': res.get('time_elapsed', 'n/a'), 'date_time': date_time})

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
    
    def _get_na_for_none(self, dict, key):
        if dict.get(key, 'n/a') == None: return 'n/a'

        return dict.get(key, 'n/a')

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
    

class SimpleTransfomer(TsvTransformer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)

    def _process_line(self, line):
        (run_data, line_type, fields) = super()._process_line(line)
        if line_type != 'NORMAL': return

        resp = line['results']['response']
        for field in self.fieldnames:
            fields[field] = resp[field]

        run_data.add_line(fields)

class ModifiedFieldNamesTransformer(TsvTransformer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.orig_fieldnames = []

    def _process_line(self, line):
        if len(self.orig_fieldnames) != len(self.fieldnames):
            raise AssertionError('The length of orig_fieldnames must be the same as the length of self.fieldnames.')
        
        (run_data, line_type, fields) = super()._process_line(line)
        if line_type != 'NORMAL': return

        res = line['results']
        for (orig_field, field) in zip(self.orig_fieldnames, self.fieldnames):
            fields[field] = self._get_na_for_none(res, orig_field)

        run_data.add_line(fields)


class MoodPrediction(TsvTransformer):
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

class PatternSeparationLearning(ModifiedFieldNamesTransformer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ["trial_index", "stimulus", "is_learning", "is_practice",
                           "pic", "type", "response", "response_time_ms", "failed_images"]
        self.orig_fieldnames = ["trial_index", "stimulus", "isLearning", "isPractice",
                           "pic", "type", "response", "rt", "failed_images"]
        self.has_multi_runs = True


class PatternSeparationRecall(TsvTransformer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ["trial_index", "stimulus", "is_recall", "pic", "type",
                           "response", "correct", "response_time_ms", "failed_images"]
        self.has_multi_runs = True

    def _process_line(self, line):
        (run_data, line_type, fields) = super()._process_line(line)
        if not line_type == 'NORMAL': return

        res = line['results']
        fields['trial_index'] = res.get('trial_index', 'n/a')
        fields['failed_images'] = res.get('failed_images', 'n/a')
        fields['stimulus'] = res.get('stimulus', 'n/a')
        response = self._get_na_for_none(res, 'response')
        fields['response'] = response
        fields['response_time_ms'] = self._get_na_for_none(res, 'rt')
        
        fields['pic'] = res.get('pic', 'n/a')
        recallType = res.get('type', 'n/a')
        fields['type'] = recallType
        fields['is_recall'] = res.get('isRecall', 'n/a')

        if res.get('pic', 'n/a') != 'n/a': # then we have a stimulus and we want to know if the response was correct
            if recallType == 'Target' and (response == '1' or response == '2'):
                fields['correct'] = True
            elif (recallType == 'Lure' or recallType == 'New') and (response == '3' or response == '4'):
                fields['correct'] = True
            else:
                fields['correct'] = False
        else:
            fields['correct'] = 'n/a'
        

        run_data.add_line(fields)

class FaceName(ModifiedFieldNamesTransformer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ["trial_index", "stimulus", "response", "category", "is_learning", "is_practice",
                           "is_recall", "name", "names", "pic_id", "lure", "response", "correct", "response_time_ms", "failed_images"]
        self.orig_fieldnames = ["trial_index", "stimulus", "response", "cat", "isLearning", "isPractice",
                           "isRecall", "name", "names", "picId", "lure", "response", "correct", "rt", "failed_images"]
        self.has_multi_runs = True

    # def _process_line(self, line):
    #     (run_data, line_type, fields) = super()._process_line(line)
    #     if not line_type == 'NORMAL': return

    #     res = line['results']
    #     fields['trial_index'] = res['trial_index']
    #     if res['trial_type'] == 'preload':
    #         fields['failed_images'] = res['failed_images']
    #     else:
    #         fields['stimulus'] = res['stimulus']
    #         fields['response'] = res['response']
    #         fields['response_time_ms'] = res['rt']
    #         for (orig_field, tsv_field) in zip(
    #             ['cat', 'correct', 'lure', 'name', 'names', 'picId'],
    #             ['category', 'correct', 'lure', 'name', 'names', 'pic_id']
    #             ):
    #             orig_val = res.get(orig_field, None)
    #             if orig_val or orig_val is False: # we want to report False for correct
    #                 fields[tsv_field] = res[orig_field]
    #             if res.get('picId', None): # then we have a stimulus and want to report False for missing values of certain fields
    #                 for (orig_bool, tsv_bool) in zip(['isPractice', 'isLearning', 'isRecall'],
    #                                                  ['is_practice', 'is_learning', 'is_recall']
    #                                                  ):
    #                     fields[tsv_bool] = res.get(orig_bool, False)

    #     run_data.add_line(fields)


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

class Ffmq(TsvTransformer):
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

class SpatialOrientation(TsvTransformer):
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
        fields['response_time_ms'] = self._get_na_for_none(res, 'rt')
        
        fields['stimulus'] = res.get('stimulus', 'n/a')
        fields['mode'] = res.get('mode', 'n/a')
        fields['center'] = res.get('center', 'n/a')
        fields['facing'] = res.get('facing', 'n/a')
        fields['target'] = res.get('target', 'n/a')
        fields['target_radians'] = res.get('targetRadians', 'n/a')
        fields['response_radians'] = res.get('responseRadians', 'n/a')
        fields['signed_radian_distance'] = res.get('signedRadianDistance', 'n/a')
        fields['time_limit_ms'] = res.get('timeLimit', 'n/a')
        fields['completion_reason'] = res.get('completionReason', 'n/a')

        run_data.add_line(fields)

class MindInEyes(ModifiedFieldNamesTransformer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ['trial_index', 'is_practice', 'stimulus', 'pic', 'words',
                            'response','response_time_ms', 'failed_images']
        self.orig_fieldnames = ['trial_index', 'isPractice', 'stimulus', 'pic', 'words',
                            'response', 'rt', 'failed_images']
        self.has_multi_runs = True

class VerbalFluency(TsvTransformer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ['trial_index', 'stimulus', 'letter', 'response']
        self.has_multi_runs = True

    def _process_line(self, line):
        (run_data, line_type, fields) = super()._process_line(line)
        if line_type != 'NORMAL': return

        res = line['results']
        for field in self.fieldnames:
            fields[field] = self._get_na_for_none(res, field)
            if field == 'response': # the task allows both spaces and \n's between words in the response; here we just want spaces
                fields[field] = fields[field].replace('\n', ' ')

        run_data.add_line(fields)

class NBack(TsvTransformer):
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
        fields['stimulus'] = res.get('stimulus', 'n/a')
        fields['n'] = res.get('n', 'n/a')
        fields['sequence'] = res.get('sequence', 'n/a')
        if res.get('missedIndices'):
            fields['missed_indices'] = [int(x) for x in res['missedIndices']]
        else:
            fields['missed_indices'] = 'n/a'
        
        if res.get('responses'):
            for (idx, response) in enumerate(res['responses']):
                self.add_response(fields, idx, 'sequence_index', response['index'])
                self.add_response(fields, idx, 'correct', response['correct'])
                self.add_response(fields, idx, 'time_from_focus', response['time_from_focus'])
                self.add_response(fields, idx, 'time_from_start', response['time_from_start'])

        run_data.add_line(fields)

class TaskSwitching(ModifiedFieldNamesTransformer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ['trial_index', 'stimulus', 'is_training', 'block_type', 'color', 'number', 'size', 'task_type', 'response', 'correct', 'response_time_ms']
        self.orig_fieldnames = ['trial_index', 'stimulus', 'isTraining', 'blockType', 'color', 'number', 'size', 'taskType', 'response', 'correct', 'rt']

class Flanker(TsvTransformer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ["trial_index", "stimulus", "is_training", "arrows", "congruent",
                           "response", "correct", "correct_response", "response_time_ms", "trial_duration_ms", 
                           "failed_images"]
        self.has_multi_runs = True
        
    def _process_line(self, line):
        (run_data, line_type, fields) = super()._process_line(line)
        if not line_type == 'NORMAL': return

        res = line['results']
        fields['trial_index'] = res.get('trial_index', 'n/a')
        fields['failed_images'] = res.get('failed_images', 'n/a')

        fields['stimulus'] = res.get('stimulus', 'n/a')
        fields['is_training'] = res.get('isTraining', 'n/a')
        if res.get('arrows', None):
            fields['arrows'] = [int(x) for x in res['arrows']]
        else:
            fields['arrows'] = 'n/a'

        fields['congruent'] = res.get('congruent', 'n/a')
        fields['response'] = res.get('response', 'n/a')
        fields['correct'] = res.get('correct', 'n/a')
        fields['correct_response'] = res.get('correct_response', 'n/a')
        fields['response_time_ms'] = res.get('rt', 'n/a')
        fields['trial_duration_ms'] = res.get('trial_duration', 'n/a')

        run_data.add_line(fields)

class EmotionalMemory(ModifiedFieldNamesTransformer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ["trial_index", "stimulus", "image_path", "response", "response_time_ms"]
        self.orig_fieldnames = ["trial_index", "stimulus", "imagePath", "response", "rt"]
        self.has_multi_runs = True

class SleepSurvey(TsvTransformer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ["Q0","Q1","Q2","Q3","Q4","Q5","Q6","Q7", "Q8"]
        self.q_map = {
            "as a passenger in a car for an hour without a break": "Q0",
            "in a car, while stopped for a few minutes in traffic": "Q1",
            "lying down to rest in the afternoon when circumstances permit": "Q2",
            "sitting and reading": "Q3",
            "sitting and talking to someone": "Q4",
            "sitting inactive in a public place (e.g., a theater or a meeting)": "Q5",
            "sitting quietly after a lunch without alcohol": "Q6",
            "watching tv": "Q7",
            "sleepiness five minutes before": "Q8"
        }

    def _process_line(self, line):
        (run_data, line_type, fields) = super()._process_line(line)
        if not line_type == 'NORMAL': return

        resp = line['results']['response']
        for (question, value) in resp.items():
            q_num = self.q_map[question]
            fields[q_num] = value

        # if resp.get("sleepiness five minutes before", None):
        #     # This survey is split across two pages, which results in a tsv
        #     # file that always has two lines: One where Q0-Q7 are filled in and Q8 isn't,
        #     # and one where only Q8 is. This fixes it so the tsv file just has one line
        #     # with Q0-Q8 filled in.
        #     prev_lines = run_data.get_lines()
        #     q_num = self.q_map["sleepiness five minutes before"]
        #     prev_lines[-1][q_num] = resp["sleepiness five minutes before"]
        # else:
        run_data.add_line(fields)

class VerbalLearningLearning(ModifiedFieldNamesTransformer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ["trial_index", "stimulus", "response", "failed_audio"]
        self.orig_fieldnames = ["trial_index", "stimulus", "response", "failed_audio"]

class VerbalLearningRecall(ModifiedFieldNamesTransformer):
    def __init__(self, data, subject, task):
        super().__init__(data, subject, task)
        self.fieldnames = ["trial_index", "stimulus", "response"]
        self.orig_fieldnames = ["trial_index", "stimulus", "response"]
