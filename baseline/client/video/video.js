import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-button-response.js";

export class Video {
    constructor(setNum) {
        this.setNum = setNum;
    }

    get taskName() {
        return this.constructor.taskName;
    }

    getTimeline() {
        if (this.setNum == 1) {
            return [{
                type: 'html-button-response',
                choices: ['Continue'],
                stimulus: '<iframe width="560" height="315" src="https://www.youtube.com/embed/vIb-peai4jE" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>'
            }];
        } else if (this.setNum == 6) {
            return [{
                type: 'html-button-response',
                choices: ['Continue'],
                stimulus: '<iframe width="560" height="315" src="https://www.youtube.com/embed/9OEjHl677fo" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>'
            }];
        } else {
            throw new Error(`In Video, expected set to be 1 or 6, but got ${this.setNum}`);
        }
    }
}

Video.taskName = "video";

