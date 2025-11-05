import { supabase } from "../config/supabaseClient.js";

// Get random 40 questions for a given course
export const getMockQuestions = async (req, res) => {
  try {
    const { course_id } = req.params;

    const { data: questions, error } = await supabase
      .from("mock_questions")
      .select("*")
      .eq("course_id", course_id);

    if (error) throw error;

    // shuffle and limit 40
    const shuffled = questions.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 40);

    res.status(200).json({
      success: true,
      totalQuestions: selected.length,
      data: selected,
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

    // Fetch correct options
    const { data: questions, error: fetchError } = await supabase
      .from("mock_questions")
      .select("id, correct_option_id")
      .eq("course_id", course_id);

    if (fetchError) throw fetchError;

    // Evaluate score
    let score = 0;
    answers.forEach((ans) => {
      const q = questions.find((q) => q.id === ans.question_id);
      if (q && q.correct_option_id === ans.selected_option_id) score++;
    });

    // Save mock attempt
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

    res.status(201).json({
      success: true,
      message: "Mock test submitted successfully",
      score,
      totalQuestions: questions.length,
      data,
    });
  } catch (err) {
    console.error("❌ Error submitting mock attempt:", err.message);
    res.status(500).json({
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

    const { data, error } = await supabase
      .from("mock_attempts")
      .select("*, courses(course_name)")
      .eq("student_id", student_id)
      .order("submitted_at", { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: data.length,
      data,
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
