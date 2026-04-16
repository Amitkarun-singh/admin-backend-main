/**
 * One-time fix: repair triple-encoded MCQ options in assessment_questions table.
 * Run: node fix-options.js
 */
import "./src/bootstrap.js";
import sequelize from "./src/config/db.js";
import AssessmentQuestion from "./src/models/assessment_question.model.js";

async function fixOptions() {
  await sequelize.authenticate();
  console.log("Connected to DB");

  const questions = await AssessmentQuestion.findAll({
    where: { question_type: ["mcq", "true_false"] },
  });

  let fixed = 0;
  for (const q of questions) {
    let opts = q.options;
    if (!opts) continue;

    // Detect character-array corruption: array of single-char strings
    if (
      Array.isArray(opts) &&
      opts.length > 8 &&
      opts.every((el) => typeof el === "string" && el.length <= 2)
    ) {
      const joined = opts.join("");
      try {
        let parsed = JSON.parse(joined);
        if (typeof parsed === "string") parsed = JSON.parse(parsed);
        if (Array.isArray(parsed) && parsed[0]?.key) {
          await q.update({ options: parsed });
          console.log(`✓ Fixed question_id=${q.question_id} (${parsed.length} options)`);
          fixed++;
        }
      } catch (e) {
        console.error(`✗ Could not fix question_id=${q.question_id}:`, e.message);
      }
    }
  }

  console.log(`\nDone. Fixed ${fixed} of ${questions.length} MCQ/TF questions.`);
  process.exit(0);
}

fixOptions().catch((e) => { console.error(e); process.exit(1); });
