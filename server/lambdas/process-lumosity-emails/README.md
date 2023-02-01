The only way that we can get information from [Lumosity](https://lumosity.com) about which participants have been practicing is for them to email us a CSV attachment every day. These emails go to [Amazon SES](https://aws.amazon.com/ses/), which writes them as a multipart-mime message to an S3 bucket. In order for the attached reports to be used, we have to process the mime message to extract the CSV file and write it to S3. The saveattachments function does that.

The processreports function extracts the information from  the CSV report file and writes it to dynamo.
