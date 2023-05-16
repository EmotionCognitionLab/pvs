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
import flywheel
import json
import csv
from pathlib import Path
import re
import tempfile


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

def combine_task_files(task_files, output_file, include_all):
    first_file = True
    with open(output_file, 'w', newline='') as outfile:
        writer = csv.writer(outfile, delimiter='\t')
        for task_file in task_files:
            m = re.match(r'sub-(?P<sub>[^_]+)_ses-(?P<sess>pre|post)_task-(?P<task>[A-z]+)_(beh.tsv|run-(?P<run>[0-9]+)_beh.tsv)', task_file.name)
            metadata = m.groupdict(default='n/a')
            with open(task_file, 'r', newline='') as infile:
                reader = csv.reader(infile, delimiter='\t')
                header = next(reader) if not first_file else next(reader, None)
                if first_file:
                    writer.writerow(header + ['sub', 'sess', 'run'])
                    first_file = False
                for row in reader:
                    if include_all or row[1] == 'True': # row[1] is is_relevant for all task types
                        writer.writerow(row + [metadata['sub'], metadata['sess'], metadata['run']])

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
        files = files_for_task(fw, project.id, tmpdir.name, args.task, sessions)
        if len(files) == 0:
            print(f'No data files found for task {args.task}.')
        else:
            combine_task_files(files, args.outfile, args.include_all)
    
    _main(_parse_args())