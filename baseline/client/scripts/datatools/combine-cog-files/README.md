# Background
For [BIDS](https://bids-specification.readthedocs.io/en/stable/01-introduction.html) purposes all of the cognitive assessment data are stored in .tsv files that are session-, task-, subject and run-specific. This means that if you wanted to analyse the results of any one cognitive assessment you'd have 100+ files - one for each run of the task for each subject for each session. Because working with hundreds of different files isn't the easiest way to run analyses, this script makes it possible to download a single .tsv file for any given cognitive assessment that combines the data for all subjects (and all sessions, by default).


# Requirements
[Python 3.9+](https://www.python.org/downloads/)

[Poetry](https://python-poetry.org/docs/)

A Flywheel API key - see step 2 of https://docs.flywheel.io/hc/en-us/articles/360008162214-Installing-the-Flywheel-Command-Line-Interface-CLI- .

# Setup
Run `poetry install`

Make sure that you have your Flywheel API key stored in a JSON config file so:

`{"key": "YOUR API KEY HERE"}`

# Usage
 `cog-to-flywheel.py --fw-conf flywheel_config_file --task taskname --outfile outfile path`

 ## Options:
 
 --fw-conf path to flywheel config file (required)
 
 --pre Combine only pre-intervention cognitive data
 
 --post Combine only post-intervention cognitive data
 
 --task taskName The task you want the combined data for (required). For BIDS purposes all tasks and camel-case, with no dashes, underscores, etc.: "nBack", "verbalLearningRecall", etc.
 
 --outfile path to file to save combined task files to (required)
 
 --include-all Include all of the task data rather than just rows marked 'isRelevant' (the default)
