import argparse
import json
import csv
from pathlib import Path
from typing import NamedTuple
from collections.abc import Iterable, Mapping

class Summary(NamedTuple):
    ...
    
def summarize_durations(trials: list[dict]) -> Mapping[str, Summary]:
    raise NotImplementedError

def parse_args() -> tuple[Path, Path]:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_json_file", type = Path)
    parser.add_argument("output_csv_file", type = Path)
    args = parser.parse_args()
    return args.input_json_file, args.output_csv_file

def main(input_json_file: Path, output_csv_file: Path) -> None:
    raise NotImplementedError

if __name__ == "__main__":
    main(*parse_args())
