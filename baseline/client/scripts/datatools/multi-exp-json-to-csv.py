import csv
import json
from pathlib import Path

timeline = ""

def extract(transform, path_str):
   # print(f"extracting from {path_str}...")
    path = Path(path_str)
    timeline = json.loads(path.read_text("utf-8"))
    fieldnames, unfiltered_rows = transform(timeline)
    rows = common_filter(unfiltered_rows)
    with path.with_suffix(path.suffix + ".csv").open("w") as csvfile:
        writer = csv.DictWriter(
            csvfile,
            fieldnames = fieldnames,
            restval = "",
            extrasaction = "raise",
            dialect = csv.unix_dialect,
        )
        writer.writeheader()
        for r in rows:
            writer.writerow(r)

def common_filter(rows):
    return tuple(
        r for r in rows
        if (
            r.get("isRelevant", False) 
            #and
            #r.get("userId") in {
            #    "7c5e2833-2bad-4b9f-b953-692d4c7542ae",
            #    "e074b8d8-ea58-4db7-b6fe-040167568a9d",
            #    "90f515d4-429b-4270-b2fa-d221603723d7",
            #    "b1dd4d4e-c8fe-4f61-ab59-85c12a710fdb",
            #}
        )
    )

def physical_activity(timeline):
    fieldnames = (
        "isRelevant",
        "dateTime",
        "userId",
        "activity_level",
        "weight",
        "height_feet",
        "height_inches",
        "age",
        "gender",
        "setNum"
    )
    
    def f(trial):
        if trial.get("isRelevant", False):
            
            if trial.get("trial_type") == "html-keyboard-response" or trial.get("trial_type") == "survey-html-form" :
                return True
            else:
                raise AssertionError
        return False
    
    def g(trial):
        row = {}
        for key, value in trial.items():
            if key in fieldnames:
                row[key] = value
        for key in ("userId", "dateTime", "trial_type", "isRelevant"):
            if key not in trial:
                row[key] = False
        
        row.update(trial["response"])
        return row
    
    return fieldnames, tuple(map(g, filter(f, timeline)))
    
def demographics(timeline):
    fieldnames = (
        "asthma",
        "inhaler_med",
        "diabetes_pre_diabetes",
        "diabetes",
        "heart_condition",
        "sleep_aide_med",
        "other_disease",
        "other_disease_which",
        "race_bi1",
        "race_bi2",
        "race_other",
        "sleep_apnea",
        "varicose_hemorrhoids",
        "thyroid_med",
        "estrogen_replacement_current",
        "antidepressant_med",
        "irregular_heartbeats",
        "heart_disease",
        "arthritis_et_al",
        "none_med",
        "estrogen_replacement_med",
        "osteoporosis_tendonitis",
        "cancer",
        "dateTime",
        "userId",
        "race",
        "ethnicity",
        "experiment",
        "trial_type",
        "isRelevant",
        "time_elapsed",
        "covid_vax",
        "med1_name",
        "med1_dose",
        "med2_name",
        "med2_dose",
        "med3_name",
        "med3_dose",
        "med4_name",
        "med4_dose",
        "med5_name",
        "med5_dose",
        "med6_name",
        "med6_dose",
        "covid_vax_1st_dose",
        "covid_vax_2nd_dose",
        "covid_positive_test1",
        "covid_positive_test2",
        "covid_positive_test3",
        "covid_count",
        "psych_diag",
        "retired",
        "weekly_alcoholic_drinks",
        "profession",
        "last_menstrual_period",
        "blood_pressure_med",
        "ever_smoked",
        "doctorNone",
        "education_years",
        "psych_diag_which",
        "hypertension",
        "heart_disease_med",
    )
    
    def f(trial):
        if trial.get("isRelevant", False):
            if trial.get("trial_type") == "survey-html-form":
                return True
            else:
                raise AssertionError
        return False
    
    def g(trial):
        row = {}
        for key, value in trial.items():
            if key in fieldnames:
                row[key] = value
        for key in ("userId", "experiment", "dateTime", "trial_type", "isRelevant", "time_elapsed"):
            if key not in trial:
                row[key] = False
        
        row.update(trial["response"])
        return row
    
    return fieldnames, tuple(map(g, filter(f, timeline)))

def pattern_separation(timeline):
    fieldnames = (
        "userId",
        "experiment",
        "dateTime",
        "trial_type",
        "trial_index",
        "isRelevant",
        "isPractice",
        "isLearning",
        "isRecall",
        "type",
        "pic",
        "response",
        "rt",
        "time_elapsed",
    )
    
    def f(trial):
        if trial.get("isRelevant", False):
            if trial.get("trial_type") == "image-keyboard-response":
                return True
            else:
                raise AssertionError
        return False
    
    def g(trial):
        row = {}
        for key, value in trial.items():
            if key in fieldnames:
                row[key] = value
        for key in ("isRelevant", "isPractice", "isLearning", "isRecall"):
            if key not in trial:
                row[key] = False
        
        return row
    return fieldnames, tuple(map(g, filter(f, timeline)))

def face_name(timeline):
    fieldnames = (
        "userId",
        "experiment",
        "dateTime",
        "trial_type",
        "trial_index",
        "isRelevant",
        "isPractice",
        "isLearning",
        "isRecall",
        "cat",
        "picId",
        "names",
        "name",
        "names",
        "response",
        "correct",
        "response",
        "rt",
        "time_elapsed",
    )
    def f(trial):
        if trial.get("isRelevant", False):
            if trial.get("trial_type") == "html-keyboard-response":
                return True
            else:
                raise AssertionError
        return False
    def g(trial):
        row = {}
        for key, value in trial.items():
            if key in fieldnames:
                if key == "names":
                    row[key] = ",".join(value)
                else:
                    row[key] = value
        for key in ("isRelevant", "isPractice", "isLearning", "isRecall"):
            if key not in trial:
                row[key] = False
        return row
    return fieldnames, tuple(map(g, filter(f, timeline)))

def panas(timeline):
    fieldnames = (
        "userId",
        "experiment",
        "dateTime",
        "trial_type",
        "trial_index",
        "isRelevant",
        "question_order",
        "interested",
        "distressed",
        "excited",
        "upset",
        "strong",
        "guilty",
        "scared",
        "hostile",
        "enthusiastic",
        "proud",
        "irritable",
        "alert",
        "ashamed",
        "inspired",
        "nervous",
        "determined",
        "attentive",
        "jittery",
        "active",
        "afraid",
        "rt",
        "time_elapsed",
    )
    def f(trial):
        if trial.get("isRelevant", False):
            if trial.get("trial_type") == "survey-likert":
                return True
            else:
                raise AssertionError
        return False
    def g(trial):
        row = {}
        for key in (
            "userId", "experiment", "dateTime", "trial_type",
            "trial_index", "isRelevant", "rt", "time_elapsed",
        ):
            row[key] = trial[key]
        row.update(trial["response"])
        return row
    return fieldnames, tuple(map(g, filter(f, timeline)))

def daily_stressors(timeline):
    fieldnames = (
        "userId",
        "experiment",
        "dateTime",
        "trial_type",
        "trial_index",
        "isRelevant",
        "Q0",
        "Q1",
        "Q2",
        "Q3",
        "Q4",
        "Q5",
        "Q6",
        "Q7",
        "rt",
        "time_elapsed",
    )
    def f(trial):
        if trial.get("isRelevant", False):
            if trial.get("trial_type") == "survey-multi-choice":
                return True
            else:
                raise AssertionError
        return False
    def g(trial):
        row = {}
        for key in (
            "userId", "experiment", "dateTime", "trial_type",
            "trial_index", "isRelevant", "rt", "time_elapsed",
        ):
            row[key] = trial[key]
        
        row.update(trial["response"])
        
        return row
    return fieldnames, tuple(map(g, filter(f, timeline)))

def dass(timeline):
    fieldnames = (
        "userId",
        "experiment",
        "dateTime",
        "trial_type",
        "trial_index",
        "isRelevant",
        "Q0",
        "Q1",
        "Q2",
        "Q3",
        "Q4",
        "Q5",
        "Q6",
        "Q7",
        "Q8",
        "Q9",
        "Q10",
        "Q11",
        "Q12",
        "Q13",
        "Q14",
        "Q15",
        "Q16",
        "Q17",
        "Q18",
        "Q19",
        "Q20",
        "rt",
        "time_elapsed",
    )
    def f(trial):
        if trial.get("isRelevant", False):
            if trial.get("trial_type") == "survey-multi-choice":
                return True
            else:
                raise AssertionError
        return False
    def g(trial):
        row = {}
        for key in (
            "userId", "experiment", "dateTime", "trial_type",
            "trial_index", "isRelevant", "rt", "time_elapsed",
        ):
            row[key] = trial[key]
        row.update(trial["response"])
        return row
    return fieldnames, tuple(map(g, filter(f, timeline)))


def ffmq(timeline):
    fieldnames = (
        "userId",
        "experiment",
        "dateTime",
        "trial_type",
        "trial_index",
        "isRelevant",
        "Q0",
        "Q1",
        "Q2",
        "Q3",
        "Q4",
        "Q5",
        "Q6",
        "Q7",
        "Q8",
        "Q9",
        "Q10",
        "Q11",
        "Q12",
        "Q13",
        "Q14",
        "rt",
        "time_elapsed",
    )
    question_key = {
        'I think some of my emotions are bad or inappropriate and I shouldn’t feel them.': 'Q0',
        'I find myself doing things without paying attention.': 'Q1',
        'When I take a shower or a bath, I stay alert to the sensations of water on my body.': 'Q2',
        'I have trouble thinking of the right words to express how I feel about things.': 'Q3',
        'I tell myself I shouldn’t be feeling the way I’m feeling.': 'Q4',
        'When I have distressing thoughts or images I just notice them and let them go.': 'Q5',
        'When I have distressing thoughts or images I am able just to notice them without reacting.': 'Q6',
        'I pay attention to sensations, such as the wind in my hair or the sun on my face.': 'Q7',
        'I don’t pay attention to what I’m doing because I’m daydreaming, worrying, or otherwise distracted.': 'Q8',
        'I do jobs or tasks automatically without being aware of what I’m doing.': 'Q9',
        'I’m good at finding words to describe my feelings.': 'Q10',
        'When I have distressing thoughts or images, I “step back” and am aware of the thought or image without getting taken over by it.': 'Q11',
        'I notice how foods and drinks affect my thoughts, bodily sensations, and emotions.': 'Q12',
        'Even when I’m feeling terribly upset I can find a way to put it into words.': 'Q13',
        'I believe some of my thoughts are abnormal or bad and I shouldn’t think that way.': 'Q14'
    }
    def f(trial):
        if trial.get("isRelevant", False):
            if trial.get("trial_type") == "survey-likert":
                return True
            else:
                raise AssertionError
        return False
 
    def g(trial):
        row = {}
        for key in (
            "userId", "experiment", "dateTime", "trial_type",
            "trial_index", "isRelevant", "rt", "time_elapsed",
        ):
            row[key] = trial[key]
        for key, value in trial["response"].items():
            assert key in question_key
            row[question_key[key]] = value
        return row
    return fieldnames, tuple(map(g, filter(f, timeline)))

if __name__ == "__main__":
    extract(physical_activity, "physical-activity.03.20.2023-20.52.40with-setnums.json")
  #   extract(pattern_separation, "pattern-separation-learning.02.19.2023-19.32.14.json")
   #  extract(pattern_separation, "pattern-separation-recall.02.19.2023-19.32.19.json")
   #  extract(face_name, "face-name.02.19.2023-19.31.31.json")
   # extract(panas, "panas.02.19.2023-19.32.08.json")
   #  extract(daily_stressors, "daily-stressors.02.19.2023-19.30.57.json")
   #  extract(dass, "dass.02.19.2023-19.31.16.json")
   #  extract(ffmq, "ffmq.02.19.2023-19.31.37.json")
   #  extract(physical_activity, "physical-activity.02.19.2023-19.32.25.json")
