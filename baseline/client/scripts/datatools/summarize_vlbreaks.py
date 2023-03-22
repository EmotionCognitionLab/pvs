import argparse
import json
from datetime import datetime
from pathlib import Path
from intertask_intervals import IntertaskIntervals

def parse_args() -> tuple[Path, Path]:
    parser = argparse.ArgumentParser()
    parser.add_argument("vll_json_file", type = Path)
    parser.add_argument("vlr_json_file", type = Path)
    args = parser.parse_args()
    return args.vll_json_file, args.vlr_json_file

def main(vll_json_file: Path, vlr_json_file: Path) -> None:
    vll_json = json.loads(vll_json_file.read_text("utf-8"))
    vlr_json = json.loads(vlr_json_file.read_text("utf-8"))

    intervals = IntertaskIntervals()

    for i in vll_json:
        if not (i.get("userId", False) and i.get("dateTime", False)):
            raise AssertionError
        
        if i.get("taskStarted", False):
            set = i.get("setNum", -1)
            intervals.set_set(i["userId"], set)

        if i.get("ua", False):
            learning_end_time = datetime.fromisoformat(i["dateTime"].replace('Z', ''))
            intervals.set_start_time(i["userId"], learning_end_time)

    for i in vlr_json:
       if not (i.get("userId", False) and i.get("dateTime", False)):
           raise AssertionError
       
       set = -1
       if i.get("taskStarted", False):
           set = i.get("setNum", -1)
           intervals.set_set(i["userId"], set)
           
       if i.get("stimulus", False) and i["stimulus"].startswith("We presented two different lists of words to you earlier"):
           recall_start_time = datetime.fromisoformat(i["dateTime"].replace('Z', ''))
           intervals.set_end_time(i["userId"], recall_start_time)
       
    print("user id, set number, seconds from learning end to recall start")
    print(intervals)

if __name__ == "__main__":
    main(*parse_args())
