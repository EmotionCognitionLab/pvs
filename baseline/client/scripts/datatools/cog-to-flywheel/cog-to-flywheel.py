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

def get_tasks_for_session(session):
    pre_tasks = ['task-ffmq', 'task-faceName', 'task-moodPrediction', 'task-dass', 'task-mindInEyes', 'task-dailyStressors', 'task-patternSeparationRecall', 'task-flanker', 'task-emotionalMemory', 'task-panas', 'task-nBack', 'task-moodMemory', 'task-patternSeparationLearning', 'task-verbalFluency', 'task-sleepSurvey', 'task-spatialOrientation', 'task-taskSwitching', 'task-verbalLearningLearning', 'task-physicalActivity', 'task-verbalLearningRecall']
    post_tasks = pre_tasks.copy()
    post_tasks.remove('task-physicalActivity')
    
    if session.label == "pre":
        return pre_tasks
    elif session.label == "post":
        return post_tasks
    else:
        raise Exception(f"Expected session to be 'pre' or 'post', but got {session.label}.")


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
    result = None
    try:
        table = dyn_client.Table("pvs-prod-experiment-data")
        resp = table.query(IndexName="userId-experimentDateTime-index", KeyConditionExpression=Key('userId').eq(aws_user_id))
    except ClientError as err:
        log.error("Error fetching aws identityId for aws userId: %s", err.response["Error"]["Message"])
    else:
        if len(resp.get("Items", [])) > 0:
            result = resp["Items"][0]["identityId"]

    return result

def has_aws_cog_data(dyn_client, aws_identity_id, sess_label):
    if sess_label == "pre":
        lowBound = 1
        highBound = 6
    elif sess_label == "post":
        lowBound = 7
        highBound = 12
    else:
        raise Exception(f"Expected session to be 'pre' or 'post', but got {sess_label}.")
    
    query_args = {
        "KeyConditionExpression": Key('identityId').eq(aws_identity_id),
        "FilterExpression": f"attribute_exists(results.setNum) and results.setNum between :lowBound and :highBound",
        "ExpressionAttributeValues": {":lowBound": lowBound, ":highBound": highBound}
    }
    try:
        result = False
        done = False
        start_key = None
        table = dyn_client.Table("pvs-prod-experiment-data")
        while not done:
            if start_key:
                query_args['ExclusiveStartKey'] = start_key
            resp = table.query(**query_args)
            start_key = resp.get('LastEvaluatedKey', None)
            done = start_key is None or len(resp.get("Items", [])) > 0
            result = len(resp.get("Items", [])) > 0

    except ClientError as err:
        log.error("Error checking for %s session cog data for aws identityId %s: %s", sess_label, aws_identity_id, err.response["Error"]["Message"])

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

def get_aws_subjects(dyn_client, human_id=None):
    result = []
    scan_args = {"ProjectionExpression": "userId, humanId"}
    if human_id:
        scan_args["FilterExpression"] = "humanId = :humId"
        scan_args["ExpressionAttributeValues"] = {":humId": human_id}
    try:
        done = False
        start_key = None
        table = dyn_client.Table("pvs-prod-users")
        while not done:
            if start_key:
                scan_args['ExclusiveStartKey'] = start_key
            response = table.scan(**scan_args)
            start_key = response.get('LastEvaluatedKey', None)
            done = start_key is None
            result.extend(response.get("Items", []))
    except ClientError as err:
        log.error("Error fetching aws subjects: %s", err.response["Error"]["Message"])

    return result

def has_missing_fw_session(fw_session_labels, aws_sessions_with_cog_data):
    for s in aws_sessions_with_cog_data:
        if not s in fw_session_labels:
            return True
        
    return False

# no_upload (used for dry runs) trumps force_upload
def upload_task_data_for_subject(dyn_client, fw_subj, aws_subj, tasks, force_upload, no_upload=False):
    aws_identity_id = aws_subj['identityId']
    if not aws_identity_id:
        print(f'No cognitive baseline data found for {aws_subj["humanId"]}.')
        return
    
    data_files_for_task = {}
    
    sessions = get_fw_subject_sessions(fw_subj)
    fw_sess_labels = list(map(lambda x: x.label, sessions))
    aws_sess_with_cog_data = []
    if has_aws_cog_data(dyn_client, aws_identity_id, "pre"):
        aws_sess_with_cog_data.append("pre")
    if has_aws_cog_data(dyn_client, aws_identity_id, "post"):
        aws_sess_with_cog_data.append("post")

    if has_missing_fw_session(fw_sess_labels, aws_sess_with_cog_data):
        log.error("Subject %s has aws cognitive data without a corresponding flywheel session. FW sessions: %s . AWS sessions with data: %s", subj.label, fw_sess_labels, aws_sess_with_cog_data)

    for sess in sessions:
        sess_acqs = sess.acquisitions()

        def find_acq(acq_label):
            for acq in sess_acqs:
                if (acq.label == acq_label): return acq
            return None
            
        if tasks:
            tasks_to_fetch = tasks
        else:
            tasks_to_fetch = get_tasks_for_session(sess)
            
        for task in tasks_to_fetch:
            print(f'Processing {fw_subj.label}/{sess.label}/{task}...')
            if not task in data_files_for_task.keys(): # we might have already fetched all of the data when doing the pre session
                task_data = get_aws_data(dyn_client, aws_identity_id, task_to_experiment(task))
                transformer = transformer_for_task(task, task_data, fw_subj.label)
                files_written = transformer.process()
                data_files_for_task[task] = files_written
            
            session_task_files = list(filter(lambda x: f'ses-{sess.label}' in x, data_files_for_task[task]))
            for f in session_task_files:
                acq_label = filename_to_acq_label(f)
                acq = find_acq(acq_label)
                needs_upload = False
                if not acq:
                    acq = sess.add_acquisition({'label': acq_label})
                    acq.reload()
                    needs_upload = True
                if len(acq.files) == 0: # at some point we somehow created acquisitions and didn't upload the files
                    needs_upload = True
            
                if needs_upload or force_upload:
                    if no_upload:
                        print(f'Would upload {f} to {acq.label} (skipping; dry run)...')
                    else:
                        print(f'Uploading {f} to {acq.label}...')
                        acq.upload_file(f)

        if len(tasks_to_fetch) == 0:
            print(f'No missing tasks found for {fw_subj.label}/{sess.label}.')


if __name__ == '__main__':
    import argparse
    import flywheel
    import json

    def _parse_args():
        parser = argparse.ArgumentParser()
        parser.add_argument('--dry-run', help="Do not upload any data to flywheel; just log what data would be uploaded", dest='dry_run', action='store_true')
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
        subjects = get_aws_subjects(dyn_client, args.user)
        identityIds = list(map(lambda subj: get_aws_identity_id_for_aws_user_id(dyn_client, subj['userId']), subjects))
        subjects = [{'humanId': subj['humanId'], 'userId': subj['userId'], 'identityId': identId} for subj, identId in zip(subjects, identityIds)]
        for aws_subj in subjects:
            if aws_subj['identityId']:
                fw_subj = fw.lookup(group_name + '/' + proj_name + '/' + aws_subj['humanId'])
                upload_task_data_for_subject(dyn_client, fw_subj, aws_subj, args.task, args.force, args.dry_run)
            else:
                print(f'No cognitive data found for {aws_subj["humanId"]}.')
        
    _main(_parse_args())
    
