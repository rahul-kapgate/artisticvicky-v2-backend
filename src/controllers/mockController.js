import { supabase } from "../config/supabaseClient.js";

// Get random 40 questions for a given course
export const getMockQuestions = async (req, res) => {
  try {
    const { course_id } = req.params;

    const limit = 1000;
    let from = 0;
    let allQuestions = [];

    // Fetch in batches of 1000 until no more rows
    while (true) {
      const { data, error } = await supabase
        .from("mock_questions")
        .select("*")
        .eq("course_id", course_id)
        .range(from, from + limit - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allQuestions = allQuestions.concat(data);
      from += limit;
    }

    if (allQuestions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No questions found for this course",
      });
    }

    // ✅ Need at least 40 questions overall
    if (allQuestions.length < 40) {
      return res.status(400).json({
        success: false,
        message:
          "Not enough questions to generate a mock test. At least 40 questions are required.",
        totalAvailable: allQuestions.length,
      });
    }

    // Split into questions with and without images
    const questionsWithImage = allQuestions.filter(
      (q) => q.image_url && q.image_url.trim() !== ""
    );
    const questionsWithoutImage = allQuestions.filter(
      (q) => !q.image_url || q.image_url.trim() === ""
    );

    // Helper: pick N random unique items from an array
    const pickRandom = (arr, count) => {
      const clone = [...arr];
      for (let i = clone.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [clone[i], clone[j]] = [clone[j], clone[i]];
      }
      return clone.slice(0, count);
    };

    // 1️⃣ Pick 10 random questions with images
    const selectedWithImage = pickRandom(questionsWithImage, 10);

    // 2️⃣ Pick remaining (40 - 10 = 30) from the rest (with or without image)
    const selectedWithImageIds = new Set(selectedWithImage.map((q) => q.id));
    const remainingPool = allQuestions.filter(
      (q) => !selectedWithImageIds.has(q.id)
    );

    const remainingNeeded = 40 - selectedWithImage.length;
    const selectedOthers = pickRandom(remainingPool, remainingNeeded);

    let finalQuestions = [...selectedWithImage, ...selectedOthers];

    // 3️⃣ Shuffle final list so image questions are mixed, not all at top
    finalQuestions = pickRandom(finalQuestions, finalQuestions.length);

    return res.status(200).json({
      success: true,
      totalQuestions: finalQuestions.length,
      totalWithImage: selectedWithImage.length,
      data: finalQuestions,
    });
  } catch (err) {
    console.error("❌ Error fetching mock questions:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch mock questions",
      error: err.message,
    });
  }
};


// Submit a mock test attempt and auto-evaluate score
export const submitMockAttempt = async (req, res) => {
  try {
    const { course_id, answers } = req.body;
    const student_id = req.user.id;

    if (!course_id || !answers?.length) {
      return res.status(400).json({
        success: false,
        message: "course_id and answers are required",
      });
    }

    const TOTAL_QUESTIONS_PER_TEST = 40; // each question = 1 mark

    // 🔹 Extract unique question IDs from submitted answers
    const questionIds = [
      ...new Set(answers.map((a) => Number(a.question_id))),
    ].filter((id) => !Number.isNaN(id));

    if (questionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid question IDs in answers",
      });
    }

    // 🔹 Fetch ONLY those questions (max 40, no 1000-row issue)
    const { data: questions, error: fetchError } = await supabase
      .from("mock_questions")
      .select("id, correct_option_id")
      .eq("course_id", course_id)
      .in("id", questionIds);

    if (fetchError) throw fetchError;

    // 🔹 Build a map keyed by stringified ID to avoid bigint vs number issues
    const questionMap = new Map(
      (questions || []).map((q) => [String(q.id), q])
    );

    // 🔹 Evaluate score
    let score = 0;

    for (const ans of answers) {
      const q = questionMap.get(String(ans.question_id));
      if (!q) continue; // question not found (shouldn't happen now, but safe)

      const correctOptionId = Number(q.correct_option_id);
      const selectedOptionId = Number(ans.selected_option_id);

      if (!Number.isNaN(correctOptionId) && !Number.isNaN(selectedOptionId)) {
        if (correctOptionId === selectedOptionId) {
          score++;
        }
      }
    }

    // 🔹 Save mock attempt
    const { data, error } = await supabase
      .from("mock_attempts")
      .insert([
        {
          student_id,
          course_id,
          answers,
          score,
          submitted_at: new Date(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      message: "Mock test submitted successfully",
      score,
      totalQuestions: TOTAL_QUESTIONS_PER_TEST, // always 40
      data,
    });
  } catch (err) {
    console.error("❌ Error submitting mock attempt:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to submit mock test",
      error: err.message,
    });
  }
};



// Get all mock attempts for a specific student
export const getMockAttemptsByStudent = async (req, res) => {
  try {
    const { student_id } = req.params;
    const { start_date, end_date } = req.query;

    // Base query
    let query = supabase
      .from("mock_attempts")
      .select("*, courses(course_name)")
      .eq("student_id", student_id)
      .order("submitted_at", { ascending: false });

    // ✅ Apply date filters if provided
    if (start_date) {
      query = query.gte("submitted_at", new Date(start_date).toISOString());
    }
    if (end_date) {
      // Add one day to include full end_date
      const endDate = new Date(end_date);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lte("submitted_at", endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: data?.length || 0,
      data,
      appliedFilters: {
        start_date: start_date || null,
        end_date: end_date || null,
      },
    });
  } catch (err) {
    console.error("❌ Error fetching mock attempts:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch mock attempts",
      error: err.message,
    });
  }
};


// Get all question details for a specific submitted attempt
export const getMockAttemptDetails = async (req, res) => {
  try {
    const { attempt_id } = req.params;

    // 1️⃣ Fetch the attempt first
    const { data: attempt, error: attemptError } = await supabase
      .from("mock_attempts")
      .select("id, student_id, course_id, answers, score, submitted_at")
      .eq("id", attempt_id)
      .single();

    if (attemptError || !attempt) {
      return res.status(404).json({
        success: false,
        message: "Attempt not found",
      });
    }

    // 2️⃣ Extract all question IDs from answers array
    const questionIds = attempt.answers.map((a) => a.question_id);

    // 3️⃣ Fetch those question details
    const { data: questions, error: questionsError } = await supabase
      .from("mock_questions")
      .select("id, question_text, options, correct_option_id, image_url, difficulty")
      .in("id", questionIds);

    if (questionsError) throw questionsError;

    // 4️⃣ Merge selected options with questions
    const mergedQuestions = questions.map((q) => {
      const ans = attempt.answers.find((a) => a.question_id === q.id);
      return {
        ...q,
        selected_option_id: ans ? ans.selected_option_id : null,
        is_correct: ans ? ans.selected_option_id === q.correct_option_id : false,
      };
    });

    // 5️⃣ Respond with full details
    res.status(200).json({
      success: true,
      attempt_id: attempt.id,
      student_id: attempt.student_id,
      course_id: attempt.course_id,
      score: attempt.score,
      total_questions: mergedQuestions.length,
      submitted_at: attempt.submitted_at,
      data: mergedQuestions,
    });
  } catch (err) {
    console.error("❌ Error fetching mock attempt details:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch attempt details",
      error: err.message,
    });
  }
};


const normalizeQuestionText = (t = "") =>
  t.trim().replace(/\s+/g, " ").toLowerCase();

const safeName = (name = "image") =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_");

async function uploadMockImage({ file, course_id }) {
  const bucket = "course-images"; // ✅ your bucket
  const folder = `mock-test-images/${course_id}`; // ✅ your folder path
  const filePath = `${folder}/${Date.now()}_${safeName(file.originalname)}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // If bucket is PUBLIC, this works:
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

export const createMockQuestion = async (req, res) => {
  try {
    const { course_id } = req.params;

    // When using multipart/form-data, fields may arrive as strings:
    let { question_text, options, correct_option_id, difficulty, image_url } = req.body;

    if (typeof options === "string") {
      try {
        options = JSON.parse(options);
      } catch {
        return res.status(400).json({ success: false, message: "options must be valid JSON" });
      }
    }

    correct_option_id = Number(correct_option_id);

    // ---- validations ----
    if (!course_id) {
      return res.status(400).json({ success: false, message: "course_id is required" });
    }
    if (!question_text || typeof question_text !== "string" || !question_text.trim()) {
      return res.status(400).json({ success: false, message: "question_text is required" });
    }
    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ success: false, message: "options must be an array (min 2)" });
    }
    if (!Number.isFinite(correct_option_id)) {
      return res.status(400).json({ success: false, message: "correct_option_id must be a number" });
    }

    const optionIds = new Set(options.map((o) => Number(o?.id)));
    if (!optionIds.has(correct_option_id)) {
      return res.status(422).json({
        success: false,
        message: "correct_option_id must match one of the option ids",
      });
    }

    // ✅ If file is attached, upload to storage and override image_url
    if (req.file) {
      image_url = await uploadMockImage({ file: req.file, course_id });
    }

    // ---- API-level duplicate check (question_text only) ----
    const normalized = normalizeQuestionText(question_text);

    // Pagination-safe duplicate check (so it works even if > 1000 questions)
    const limit = 1000;
    let from = 0;
    let foundDuplicate = false;

    while (true) {
      const { data, error } = await supabase
        .from("mock_questions")
        .select("id, question_text")
        .eq("course_id", course_id)
        .range(from, from + limit - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      if (data.some((q) => normalizeQuestionText(q.question_text) === normalized)) {
        foundDuplicate = true;
        break;
      }

      from += limit;
    }

    if (foundDuplicate) {
      return res.status(409).json({
        success: false,
        message: "Duplicate question_text already exists for this course",
      });
    }

    // ---- insert ----

    const row = {
      course_id: Number(course_id),
      question_text: question_text.trim(),
      options,
      correct_option_id: Number(correct_option_id),
      difficulty: difficulty ?? null,
      image_url: image_url ?? null,
    };

    const { data: created, error: insertError } = await supabase
      .from("mock_questions")
      .insert([row])
      .select("*")
      .single();

    if (insertError) throw insertError;

    return res.status(201).json({
      success: true,
      message: "Mock question created successfully",
      data: created,
    });
  } catch (err) {
    console.error("❌ Error creating mock question:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create mock question",
      error: err.message,
    });
  }
};
