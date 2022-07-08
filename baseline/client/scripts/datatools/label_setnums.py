def label_setnums(trials):
    """
    Modify the trials list argument to have a setNum key-value pair on each trial."""
    latest_trial_by_user = {}  # mapping of user IDs to their most recent trial
    for t in trials:
        # check for missing fields
        user = t.get("userId")
        if not user:
            raise AssertionError("trial missing userId")
        dt = t.get("dateTime")
        if not dt:
            raise AssertionError("trial missing dateTime")
        # guarantee that the ordering of trials is consistent with the dateTime values
        last = latest_trial_by_user.get(user)
        if last and dt < last["dateTime"]:
            raise AssertionError("trial later in list has earlier dateTime")
        # add value for setNum to trials with falsy taskStarted (non-set-header trials)
        if not t.get("taskStarted"):
            if t.get("setNum"):
                raise AssertionError("trial with falsy taskStarted already has value for setNum")
            elif not last:
                raise AssertionError("trial with falsy taskStarted has no preceding taskStarted")
            t["setNum"] = last["setNum"]
        # update latest_trial_by_user
        latest_trial_by_user[user] = t


if __name__ == "__main__":
    import argparse
    import json
    import pathlib

    def _parse_args():
        parser = argparse.ArgumentParser()
        parser.add_argument("ijsonfile", type = pathlib.Path)
        parser.add_argument("ojsonfile", type = pathlib.Path)
        args = parser.parse_args()
        return args.ijsonfile, args.ojsonfile

    def _main(ijsonfile, ojsonfile):
        # read from file
        itext = ijsonfile.read_text()
        # load JSON as trials list
        trials = json.loads(itext)
        # add setNum key-value pairs
        label_setnums(trials)
        # output trials list as JSON
        otext = json.dumps(trials)
        # write to file
        ojsonfile.write_text(otext)

    _main(*_parse_args())
