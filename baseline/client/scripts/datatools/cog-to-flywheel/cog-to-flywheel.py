#!/usr/bin/env python3

# Use this script to load both pre- and post-intervention cognitive assessment data from
# AWS DynamoDB into Flywheel. Without any options it will query Flywheel for existing subjects,
# check each subject for any missing cognitive assessment data, request any missing data
# from AWS, transform the original JSON data to .tsv format, and store it in Flywheel.

# Usage:
# cog-to-flywheel.py --fw-conf flywheel_config_file
# Options:
# --force Load the data even if it already exists. Note that this option without any others will re-load all data for all subjects!
# --fw-conf path to flywheel config file (required)
# --pre Load only pre-intervention cognitive data
# --post Load only post-intervention cognitive data
# --task taskName1 taskName2 ... Load only data for the given task name(s)
# --user userId Load only data for the given userId (7 character human id)

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
import logging
log = logging.getLogger(__name__)
import re
from tsv_transformer import transformer_for_task

def get_fw_subject_sessions(subject):
    return list(filter(lambda s: s.label == 'pre' or s.label == 'post', subject.sessions()))

def get_fw_missing_tasks(session, include_all):    
    pre_tasks = ['task-ffmq', 'task-faceName', 'task-moodPrediction', 'task-dass', 'task-mindInEyes', 'task-dailyStressors', 'task-patternSeparationRecall', 'task-flanker', 'task-emotionalMemory', 'task-panas', 'task-nBack', 'task-moodMemory', 'task-patternSeparationLearning', 'task-verbalFluency', 'task-sleepSurvey', 'task-spatialOrientation', 'task-taskSwitching', 'task-verbalLearningLearning', 'task-physicalActivity', 'task-verbalLearningRecall']
    post_tasks = pre_tasks.copy()
    post_tasks.remove('task-physicalActivity')
    
    if session.label == "pre":
        task_list = pre_tasks
    elif session.label == "post":
        task_list = post_tasks
    else:
        raise Exception(f"Expected session to be 'pre' or 'post', but got {session.label}.")
    
    if not include_all:
        acqs = session.acquisitions()
        for acq in acqs:
            if acq.label in task_list:
                task_list.remove(acq.label)
    
    return task_list


def task_to_experiment(task_name):
    name_match = re.search(r'task-([^_]+)', task_name)
    return re.sub(r'([A-Z]+)', lambda x: f'-{x.group().lower()}', name_match.group(1))

def filename_to_acq_label(fname):
    return re.sub(r'sub-[A-z]+_ses-[A-z]+_(.*)_beh.tsv', lambda x: f'beh_{x.group(1)}', fname)

def get_aws_user_id_for_user_id(dyn_client, user_id):
    result = ""
    scan_args = {
        "FilterExpression": f"humanId = :humId",
        "ExpressionAttributeValues": {":humId": user_id},
        "ProjectionExpression": "userId"
    }
    try:
        done = False
        start_key = None
        table = dyn_client.Table("pvs-prod-users")
        while not done:
            if start_key:
                scan_args['ExclusiveStartKey'] = start_key
            response = table.scan(**scan_args)
            start_key = response.get('LastEvaluatedKey', None)
            done = start_key is None or len(response.get("Items", [])) == 1
            if done and len(response.get("Items", [])) != 1:
                raise Exception(f"Expected to find one user with id {user_id}, but found {len(response.get('Items', []))}.")
            elif done:
                result = response.get("Items")[0]["userId"]
    except ClientError as err:
        log.error("Error fetching aws userId for userId: %s", err.response["Error"]["Message"])

    return result

def get_aws_identity_id_for_aws_user_id(dyn_client, aws_user_id):
    result = ""
    try:
        table = dyn_client.Table("pvs-prod-experiment-data")
        resp = table.query(IndexName="userId-experimentDateTime-index", KeyConditionExpression=Key('userId').eq(aws_user_id))
    except ClientError as err:
        log.error("Error fetching aws identityId for aws userId: %s", err.response["Error"]["Message"])
    else:
        if len(resp.get("Items", [])) > 0:
            result = resp["Items"][0]["identityId"]

    return result

def get_aws_data(dyn_client, aws_identity_id, task):
    key = Key("identityId").eq(aws_identity_id) & Key("experimentDateTime").begins_with(task)
    query_args = {"KeyConditionExpression": key}
    result = []
    try:
        done = False
        start_key = False
        table = dyn_client.Table("pvs-prod-experiment-data")
        while not done:
            if start_key:
                query_args["ExclusiveStartKey"] = start_key
            response = table.query(**query_args)
            start_key = response.get('LastEvaluatedKey', None)
            done = start_key is None
            result.extend(response.get("Items", []))
    except ClientError as err:
        log.error(f"Error fetching data for {aws_identity_id}/{task}: %s", err.response["Error"]["Message"])

    return result

def upload_task_data_for_subject(dyn_client, fw_client, subj, tasks, include_all_tasks):
    aws_user_id = get_aws_user_id_for_user_id(dyn_client, subj.label)
    aws_identity_id = get_aws_identity_id_for_aws_user_id(dyn_client, aws_user_id)
    data_files_for_task = {}
    
    sessions = get_fw_subject_sessions(subj)
    for sess in sessions:
        sess_acqs = sess.acquisitions()

        def find_acq(acq_label):
            for acq in sess_acqs:
                if (acq.label == acq_label): return acq
            return None
            
        if tasks:
            tasks_to_fetch = tasks
        else:
            tasks_to_fetch = get_fw_missing_tasks(sess, include_all_tasks)
            
        # print(f"tasks missing from {subj.label}/{sess.label}")
        for task in tasks_to_fetch:
            print(f'Processing {subj.label}/{sess.label}/{task}...')
            if not task in data_files_for_task.keys(): # we might have already fetched all of the data when doing the pre session
                task_data = get_aws_data(dyn_client, aws_identity_id, task_to_experiment(task))
                transformer = transformer_for_task(task, task_data, subj.label)
                files_written = transformer.process()
                data_files_for_task[task] = files_written
            
            session_task_files = list(filter(lambda x: f'ses-{sess.label}' in x, data_files_for_task[task]))
            for f in session_task_files:
                acq_label = filename_to_acq_label(f)
                acq = find_acq(acq_label)
                if not acq:
                    acq = sess.add_acquisition({'label': acq_label})
                    acq.reload()
            
                print(f'Uploading {f} to {acq.label}...')
                acq.upload_file(f)


if __name__ == '__main__':
    import argparse
    import flywheel
    import json

    def _parse_args():
        parser = argparse.ArgumentParser()
        parser.add_argument('--force', help='Load data even for tasks that already exist in flywheel', action='store_true')
        parser.add_argument('--fw-conf', help='Path to your Flywheel config file that contains your API key', dest='fw_conf', required=True)
        parser.add_argument('--task', help='Names of one or more tasks to load, separated by commas. Implies --force.', nargs='*')
        parser.add_argument('--user')
        args = parser.parse_args()
        return args
    
    def _main(args):
        with open(args.fw_conf) as f:
            fw_conf = json.load(f)
        
        fw = flywheel.Client(fw_conf['key'])
        dyn_client = boto3.resource('dynamodb')
        group_name = 'emocog'
        proj_name = '2023_HeartBEAM'
        project = fw.lookup(group_name + '/' + proj_name)
        if args.user:
            subjects = [fw.lookup(group_name + '/' + proj_name + '/' + args.user)]
        else:
            subjects = project.subjects()

        for subj in subjects:
            upload_task_data_for_subject(dyn_client, fw, subj, args.task, args.force)

        # task_data = get_aws_data(dyn_client, 'us-west-2:a84cab91-9237-49f8-ac68-1956a2ccdb73', 'mood-prediction')
        # transformer = transformer_for_task('task-moodPrediction', task_data, 'AvidJar')
        # files_written = transformer.process()
        # print(files_written)

        

                

       
        

    _main(_parse_args())
    
