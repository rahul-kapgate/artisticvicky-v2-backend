import { supabase } from "../config/supabaseClient.js";

// Get random 40 questions for a given course
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

    // Shuffle and select 40 random questions
    const shuffled = allQuestions.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 40);

    return res.status(200).json({
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
      totalQuestions: 40,
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
