import argparse
import json
import csv
from pathlib import Path
from typing import NamedTuple
from collections.abc import Iterable, Mapping

class VLBreak(NamedTuple):
    ...
    
def summarize_vlbreaks(trials: list[dict]) -> Mapping[str, VLBreak]:
    raise NotImplementedError

def parse_args() -> tuple[Path, Path, Path]:
    parser = argparse.ArgumentParser()
    parser.add_argument("vll_json_file", type = Path)
    parser.add_argument("vlr_json_file", type = Path)
    parser.add_argument("csv_file", type = Path)
    args = parser.parse_args()
    return args.vll_json_file, args.vlr_json_file, args.csv_file

def main(vll_json_file: Path, vlr_json_file: Path, csv_file: Path) -> None:
    raise NotImplementedError

if __name__ == "__main__":
    main(*parse_args())
