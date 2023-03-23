import argparse
import json
from datetime import datetime
from pathlib import Path
from intertask_intervals import IntertaskIntervals

def parse_args() -> tuple[str, Path, Path]:
    parser = argparse.ArgumentParser()
    parser.add_argument("-t", "--task", required=True, choices=["pattern-separation", "verbal-learning"])
    parser.add_argument("learning_json_file", type = Path)
    parser.add_argument("recall_json_file", type = Path)
    args = parser.parse_args()
    return args.task, args.learning_json_file, args.recall_json_file

def get_set_and_learning_end_times(learning_json: str, intervals: IntertaskIntervals) -> None:
    for i in learning_json:
        if not (i.get("userId", False) and i.get("dateTime", False)):
            raise AssertionError
        
        if i.get("taskStarted", False):
            set = i.get("setNum", -1)
            intervals.set_set(i["userId"], set)

        if i.get("ua", False):
            learning_end_time = datetime.fromisoformat(i["dateTime"].replace('Z', ''))
            intervals.set_start_time(i["userId"], learning_end_time)

def get_recall_start_times(recall_json: str, intervals: IntertaskIntervals, recall_filter) -> None:
    set = -1
    for i in recall_json:
       if not (i.get("userId", False) and i.get("dateTime", False)):
           raise AssertionError
       
       if i.get("taskStarted", False):
           set = i.get("setNum", -1)
           intervals.set_set(i["userId"], set)
           
       if recall_filter(i):
           if set == -1:
               raise AssertionError
           
           recall_start_time = datetime.fromisoformat(i["dateTime"].replace('Z', ''))
           intervals.set_end_time(i["userId"], set, recall_start_time)
           set = -1

def vl_recall_filter(item):
    return item.get("stimulus", False) and item["stimulus"].startswith("We presented two different lists of words to you earlier")

def ps_recall_filter(item):
    return item.get("trial_type", "") == "html-keyboard-response" and item.get("stimulus", "").find("be tested on your memory") > -1

def main(task: str, learning_json_file: Path, recall_json_file: Path) -> None:
    learning_json = json.loads(learning_json_file.read_text("utf-8"))
    recall_json = json.loads(recall_json_file.read_text("utf-8"))

    intervals = IntertaskIntervals()

    get_set_and_learning_end_times(learning_json, intervals)
    
    if (task == 'verbal-learning'):
        get_recall_start_times(recall_json, intervals, vl_recall_filter)
    else:
        get_recall_start_times(recall_json, intervals, ps_recall_filter)
       
    print("user id, set number, seconds from learning end to recall start")
    print(intervals)

if __name__ == "__main__":
    main(*parse_args())
