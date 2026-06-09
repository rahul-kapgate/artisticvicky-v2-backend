import { supabase } from "../config/supabaseClient.js";
import { s3 } from "../config/s3Client.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";

// 1️⃣ Get all PYQ papers for a course
export const getPYQPapers = async (req, res) => {
  try {
    const { course_id } = req.params;
    const { data, error } = await supabase
      .from("pyq_papers")
      .select("*")
      .eq("course_id", course_id)
      .order("year", { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    console.error("❌ Error fetching PYQ papers:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch PYQ papers",
      error: err.message,
    });
  }
};

// 2️⃣ Get all questions for a specific paper
export const getPYQQuestions = async (req, res) => {
  try {
    const { paper_id } = req.params;
    const { data, error } = await supabase
      .from("pyq_questions")
      .select("*")
      .eq("paper_id", paper_id)
      .order("id", { ascending: true });;

    if (error) throw error;

    console.log("PQY");

    res.status(200).json({
      success: true,
      totalQuestions: data.length,
      data,
    });
  } catch (err) {
    console.error("❌ Error fetching PYQ questions:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch PYQ questions",
      error: err.message,
    });
  }
};

// 3️⃣ Submit PYQ attempt (optional)
export const submitPYQAttempt = async (req, res) => {
  try {
    const { paper_id, answers } = req.body;
    const student_id = req.user.id;

    if (!paper_id || !answers?.length) {
      return res.status(400).json({
        success: false,
        message: "paper_id and answers are required",
      });
    }

    // Fetch correct answers
    const { data: questions, error: fetchError } = await supabase
      .from("pyq_questions")
      .select("id, correct_option_id")
      .eq("paper_id", paper_id);

    if (fetchError) throw fetchError;

    // Evaluate score
    let score = 0;
    answers.forEach((ans) => {
      const q = questions.find((q) => q.id === ans.question_id);
      if (q && q.correct_option_id === ans.selected_option_id) score++;
    });

    // Save attempt
    const { data, error } = await supabase
      .from("pyq_attempts")
      .insert([
        {
          student_id,
          paper_id,
          answers,
          score,
          submitted_at: new Date(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: "PYQ attempt submitted successfully",
      score,
      totalQuestions: questions.length,
      data,
    });
  } catch (err) {
    console.error("❌ Error submitting PYQ attempt:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to submit PYQ attempt",
      error: err.message,
    });
  }
};

// 4️⃣ Get all PYQ attempts by student
export const getPYQAttemptsByStudent = async (req, res) => {
  try {
    const { student_id } = req.params;
    const { data, error } = await supabase
      .from("pyq_attempts")
      .select("*, pyq_papers(year, course_id)")
      .eq("student_id", student_id)
      .order("submitted_at", { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    console.error("❌ Error fetching PYQ attempts:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch PYQ attempts",
      error: err.message,
    });
  }
};

// 5️⃣ Get detailed PYQ attempt
export const getPYQAttemptDetails = async (req, res) => {
  try {
    const { attempt_id } = req.params;

    // Fetch attempt
    const { data: attempt, error: attemptError } = await supabase
      .from("pyq_attempts")
      .select("id, student_id, paper_id, answers, score, submitted_at")
      .eq("id", attempt_id)
      .single();

    if (attemptError || !attempt) {
      return res.status(404).json({
        success: false,
        message: "Attempt not found",
      });
    }

    // Extract question IDs
    const questionIds = attempt.answers.map((a) => a.question_id);

    // Fetch those questions
    const { data: questions, error: qErr } = await supabase
      .from("pyq_questions")
      .select("id, question_text, options, correct_option_id, image_url, difficulty")
      .in("id", questionIds);

    if (qErr) throw qErr;

    // Merge
    const merged = questions.map((q) => {
      const ans = attempt.answers.find((a) => a.question_id === q.id);
      return {
        ...q,
        selected_option_id: ans?.selected_option_id || null,
        is_correct: ans ? ans.selected_option_id === q.correct_option_id : false,
      };
    });

    res.status(200).json({
      success: true,
      attempt_id: attempt.id,
      paper_id: attempt.paper_id,
      student_id: attempt.student_id,
      score: attempt.score,
      total_questions: merged.length,
      submitted_at: attempt.submitted_at,
      data: merged,
    });
  } catch (err) {
    console.error("❌ Error fetching PYQ attempt details:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch attempt details",
      error: err.message,
    });
  }
};


// Get all PYQ questions with images
export const getPYQQuestionsWithImages = async (req, res) => {
  try {
    const { paper_id } = req.params;

    const { data, error } = await supabase
      .from("pyq_questions")
      .select(`
        id,
        question_text,
        options,
        correct_option_id,
        image_url,
        difficulty,
        marks
      `)
      .eq("paper_id", paper_id)
      .not("image_url", "is", null)
      .neq("image_url", "")
      .order("id", { ascending: true });

    if (error) throw error;

    res.status(200).json({
      success: true,
      totalQuestions: data.length,
      data,
    });
  } catch (err) {
    console.error("❌ Error fetching PYQ questions with images:", err.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch PYQ questions",
      error: err.message,
    });
  }
};


const safeName = (name = "image") =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_");

async function uploadPYQImage({ file, paper_id }) {
  const bucket = process.env.AWS_S3_BUCKET;
  const fileKey = `pyq-images/${paper_id}/${Date.now()}_${safeName(file.originalname)}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: fileKey,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await s3.send(command);

  return `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
}

export const updatePYQQuestionImage = async (req, res) => {
  try {
    const { question_id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image is required",
      });
    }

    const { data: question, error } = await supabase
      .from("pyq_questions")
      .select("id, paper_id")
      .eq("id", question_id)
      .single();

    if (error || !question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    const image_url = await uploadPYQImage({
      file: req.file,
      paper_id: question.paper_id,
    });

    const { data: updated, error: updateError } = await supabase
      .from("pyq_questions")
      .update({
        image_url,
      })
      .eq("id", question_id)
      .select("*")
      .single();

    if (updateError) throw updateError;

    return res.status(200).json({
      success: true,
      message: "Image updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("❌ Error updating PYQ image:", err.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update image",
      error: err.message,
    });
  }
};