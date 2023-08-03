#!/usr/bin/env python3

# Use this script to generate a .tsv file containing all of the data from all participants
# for a given task (optionally just for either the pre or post session).

# Usage:
# cog-to-flywheel.py --fw-conf flywheel_config_file --task taskname --outfile outfile path
# Options:
# --fw-conf path to flywheel config file (required)
# --pre Combine only pre-intervention cognitive data
# --post Combine only post-intervention cognitive data
# --task taskName The task you want the combined data for (required)
# --outfile path to file to save combined task files to (required)
# --include-all Include all of the task data rather than just rows marked 'isRelevant' (the default)

import logging
log = logging.getLogger(__name__)
import argparse
from collections import defaultdict
import flywheel
import hashlib
import json
import csv
from pathlib import Path
import random
import re
import string
import tempfile

# Loads the hashed-user-id <-> condition map
def get_user_map(file):
    with open(file) as f:
        user_map = json.load(f)

    return user_map

# Maps the letters 'F' and 'P' (our two conditions) 
# to two randomly-selected letters. Must only be called
# once per run!
def make_condition_map():
    two_letters = random.sample(list(string.ascii_uppercase), 2)
    condition_map = defaultdict(lambda: 'unk')
    condition_map['F'] = two_letters[0]
    condition_map['P'] = two_letters[1]
    return condition_map

def files_for_task(fw_client, project_id, tmpdir, task, sessions=[]):
    result = []
    if len(sessions) == 0:
        sessions = ['pre', 'post']
    
    for sess_name in sessions:
        if sess_name != 'pre' and sess_name !='post':
            log.error(f'{sess} is not a supported session - skipping.')
            continue

        fw_sessions = fw_client.get_project_sessions(project_id, filter=f'label={sess_name}')
        for sess in fw_sessions:
            acqs = fw_client.acquisitions.iter_find(f'session={sess.id}', f'label=~beh_task-{task}.*')
            for acq in acqs:
                if not task in acq.label: # just double-checking
                    continue

                for f in [x for x in acq.files if re.match(rf'sub-[^_]+_ses-{sess.label}_task-{task}.*_beh.tsv', x.name)]:
                    print(f'Downloading file {f.name} from {sess.label}/{acq.label}...')
                    dest_file = Path(tmpdir) / f.name
                    fw_client.download_file_from_acquisition(acq.id, f.name, dest_file, view=False)
                    result.append(dest_file)

    return result

def metadata_from_task_file_name(task_file_name, user_map, rand_condition_map):
    m = re.match(r'sub-(?P<sub>[^_]+)_ses-(?P<sess>pre|post)_task-(?P<task>[A-z]+)_(beh.tsv|run-(?P<run>[0-9]+)_beh.tsv)', task_file_name)
    metadata = m.groupdict(default='n/a')
    hashed_id = hashlib.shake_128(metadata['sub'].encode('utf-8')).hexdigest(16)
    condition = rand_condition_map[user_map.get(hashed_id)]
    return (hashed_id, condition, metadata['sess'], metadata['run'])

# nback is odd in that different files may have a different number of columns
# check the first row of each nback file and return the longest of them
def find_longest_nback_header(nback_files):
    longest_header = ''
    for nback_file in nback_files:
        with open(nback_file, 'r') as infile:
            reader = csv.reader(infile, delimiter='\t')
            header = next(reader)
            if len(header) > len(longest_header): longest_header = header

    return longest_header

# nback is odd in that different files may have a different number of columns
# works like combine_task_files, but adds empty columns as necessary to pad out
# files that have fewer
def combine_nback_files(nback_files, output_file, include_all, user_map, rand_condition_map):
    longest_header = find_longest_nback_header(nback_files)
    first_file = True
    with open(output_file, 'w', newline='') as outfile:
        writer = csv.writer(outfile, delimiter='\t')
        for nback_file in nback_files:
            (sub, condition, sess, run) = metadata_from_task_file_name(nback_file.name, user_map, rand_condition_map)
            with open(nback_file, 'r', newline='') as infile:
                reader = csv.reader(infile, delimiter='\t')
                header = next(reader)
                extra_field_count = len(longest_header) - len(header)
                if first_file:
                    writer.writerow(longest_header + ['sub', 'condition', 'sess', 'run'])
                    first_file = False
                for row in reader:
                    if include_all or row[1] == 'True': # row[1] is is_relevant for all task types
                        writer.writerow(row + ['\t'] * extra_field_count + [sub, condition, sess, run])


def combine_task_files(task_files, output_file, include_all, user_map, rand_condition_map):
    if 'nBack' in task_files[0].name:
        combine_nback_files(task_files, output_file, include_all, user_map, rand_condition_map)
        return
    
    first_file = True
    with open(output_file, 'w', newline='') as outfile:
        writer = csv.writer(outfile, delimiter='\t')
        for task_file in task_files:
            (sub, condition, sess, run) = metadata_from_task_file_name(task_file.name, user_map, rand_condition_map)
            with open(task_file, 'r', newline='') as infile:
                reader = csv.reader(infile, delimiter='\t')
                header = next(reader) if not first_file else next(reader, None)
                if first_file:
                    writer.writerow(header + ['sub', 'condition', 'sess', 'run'])
                    first_file = False
                for row in reader:
                    if include_all or row[1] == 'True': # row[1] is is_relevant for all task types
                        writer.writerow(row + [sub, condition, sess, run])

if __name__ == '__main__':

    def _parse_args():
        parser = argparse.ArgumentParser()
        parser.add_argument('--fw-conf', help='Path to your Flywheel config file that contains your API key', dest='fw_conf', required=True)
        parser.add_argument('--task', help='Name of the task you want the data for', required=True)
        parser.add_argument('--outfile', help='Path to the file your results should be saved in', required=True)
        parser.add_argument('--pre', help='Only include pre session results', action='store_true')
        parser.add_argument('--post', help='Only include post session results', action='store_true')
        parser.add_argument('--include-all', help='Include all results (prompts, fixation points, etc.), not just relevant results', action='store_true', dest='include_all')
        args = parser.parse_args()
        return args
    
    def _main(args):
        with open(args.fw_conf) as f:
            fw_conf = json.load(f)
        
        fw = flywheel.Client(fw_conf['key'])
        group_name = 'emocog'
        proj_name = '2023_HeartBEAM'
        project = fw.lookup(group_name + '/' + proj_name)
        tmpdir = tempfile.TemporaryDirectory()
        sessions = []
        if (args.pre): sessions.append('pre')
        if (args.post): sessions.append('post')
        user_map = get_user_map('user-condition.json')
        condition_map = make_condition_map()
        files = files_for_task(fw, project.id, tmpdir.name, args.task, sessions)
        if len(files) == 0:
            print(f'No data files found for task {args.task}.')
        else:
            combine_task_files(files, args.outfile, args.include_all, user_map, condition_map)
    
    _main(_parse_args())