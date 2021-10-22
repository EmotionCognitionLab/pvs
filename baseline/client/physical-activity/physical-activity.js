import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-survey-html-form";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/common.css";
import "./style.css";

export class PhysicalActivity {
    getTimeline() {
        const formTrial = {
            type: "survey-html-form",
            preamble: "<h2>Phsyical Activity Survey</h2>",
            html: this.constructor.form,
            css_classes: ['physact'],
            data: {isRelevant: true}
        };
        
        return [formTrial]
    }

    get taskName() {
        return this.constructor.taskName;
    }
}

PhysicalActivity.taskName = "physical-activity";

// We put this here rather than in a standalone file
// so that it is loaded for tests. If it's in a standalone
// file we just get "test.file.stub" instead of all this HTML.
PhysicalActivity.form = `
<div class="pa-question">
    Please rate your physical activity: <br/>

    <ol>
        <li>Do not participate regularly in programmed recreation, sport, or physical activity.</li>
        <input type="radio" name="activity_level" id="point0" value="0" required="true">
        <label for="point0">Avoid walking or exercise (for example, always use elevators, drive whenever possible instead of walking).</label>
        <br/>
        <input type="radio" name="activity_level" id="point1" value="1" required="true">
        <label for="point1">Walk for pleasure, routinely use stairs, occasionally exercise sufficiently to cause heavy breathing or perspiration.</label>

        <li>Participate regularly in recreation or work requiring modest physical activity (such as golf, horseback riding, calisthenics, gymnastics, table tennis, bowling, weight lifting, or yard work).</li>
        <input type="radio" name="activity_level" id="point2" value="2" required="true">
        <label for="point2">10–60 minutes per week</label>
        <br/>
        <input type="radio" name="activity_level" id="point3" value="3" required="true">
        <label for="point3">Over 1 hour per week</label>

        <li>Participate regularly in heavy physical exercise (such as running or jogging, swimming, cycling, rowing, skipping rope, running in place) or engage in vigorous aerobic type activity (such as tennis, basketball, or handball).</li>
        <input type="radio" name="activity_level" id="point4" value="4" required="true">
        <label for="point4">Run less than 1 mile per week or spend less than 30 minutes per week in comparable physical activity.</label>
        <br/>
        <input type="radio" name="activity_level" id="point5" value="5" required="true">
        <label for="point5">Run 1–5 miles per week or spend 30–60 minutes per week in comparable physical activity.</label>
        <br/>
        <input type="radio" name="activity_level" id="point6" value="6" required="true">
        <label for="point6">Run 5–10 miles per week or spend 1–3 hours per week in comparable physical activity.</label>
        <br/>
        <input type="radio" name="activity_level" id="point7" value="7" required="true">
        <label for="point7">Run more than 10 miles per week or spend more than 3 hours per week in comparable physical activity.</label>
        <br/>
    </ol>

    <label for="weight">Body weight (lbs.): </label>
    <input type="number" min="50" max="300" name="weight" id="weight" required="true">
    <br/>
    Height: <input type="number" min="2" max="8" name="height_feet" id="height_feet" required="true">
    <label for="height_feet">feet</label>
    <input type="number" min="0" max="11" name="height_inches" id="height_inches" required="true">
    <label for="height_inches">inches</label>
    <br/>
    Age: <input type="number" min="18" max="100" name="age" id="age" required="true">
    <label for="age">years old</label>
    <br/>
    <label for="gender">Gender</label>
    <select name="gender" id="gender" required="true">
        <option value="" selected>Please select</option>
        <option value="0">Male</option>
        <option value="1">Female</option>
    </select>
</div>
`

if (window.location.href.includes(PhysicalActivity.taskName)) {
    jsPsych.init({
        timeline: (new PhysicalActivity()).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}