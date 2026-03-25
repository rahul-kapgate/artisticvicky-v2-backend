import { supabase } from "../config/supabaseClient.js";
import XLSX from "xlsx";

// helper
const sanitizeQuestionsForStudent = (questions = []) =>
  questions.map((q) => ({
    id: q.id,
    question_text: q.question_text,
    options: q.options,
    difficulty: q.difficulty ?? null,
    image_url: q.image_url ?? null,
  }));

// ADMIN: create draft live test using first 40 questions
export const createLiveTest = async (req, res) => {
  try {
    const {
      title,
      description = "",
      course_id,
      duration_minutes = 60,
    } = req.body;

    if (!title || !course_id) {
      return res.status(400).json({
        success: false,
        message: "title and course_id are required",
      });
    }

    // first 40 questions for this course
    const { data: questions, error: questionsError } = await supabase
      .from("mock_questions")
      .select("*")
      .eq("course_id", course_id)
      .order("id", { ascending: true })
      .limit(40);

    if (questionsError) throw questionsError;

    if (!questions || questions.length < 40) {
      return res.status(400).json({
        success: false,
        message: "At least 40 questions are required to create a live test",
      });
    }

    const payload = {
      title,
      description,
      course_id,
      duration_minutes,
      total_questions: 40,
      status: "draft",
      is_public: false,
      question_ids: questions.map((q) => q.id),
      question_snapshot: questions,
      created_by: req.user?.id ?? null,
    };

    const { data, error } = await supabase
      .from("live_tests")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      message: "Live test created successfully",
      data,
    });
  } catch (error) {
    console.error("createLiveTest error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ADMIN: publish live test
export const publishLiveTest = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("live_tests")
      .update({
        status: "published",
        is_public: true,
        published_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Live test published successfully",
      data,
    });
  } catch (error) {
    console.error("publishLiveTest error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ADMIN: unpublish live test
export const unpublishLiveTest = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("live_tests")
      .update({
        status: "draft",
        is_public: false,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Live test unpublished successfully",
      data,
    });
  } catch (error) {
    console.error("unpublishLiveTest error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// PUBLIC: list all published live tests for home page
export const getPublicLiveTests = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("live_tests")
      .select("id, title, description, course_id, duration_minutes, total_questions, published_at")
      .eq("is_public", true)
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Published live tests fetched successfully",
      data: data || [],
    });
  } catch (error) {
    console.error("getPublicLiveTests error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// STUDENT: fetch one live test
export const getLiveTestById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("live_tests")
      .select("*")
      .eq("id", id)
      .eq("is_public", true)
      .eq("status", "published")
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Live test fetched successfully",
      data: {
        id: data.id,
        title: data.title,
        description: data.description,
        duration_minutes: data.duration_minutes,
        total_questions: data.total_questions,
        questions: sanitizeQuestionsForStudent(data.question_snapshot),
      },
    });
  } catch (error) {
    console.error("getLiveTestById error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// STUDENT: submit live test
export const submitLiveTest = async (req, res) => {
  try {
    const { id } = req.params;
    const { answers } = req.body;
    const student_id = req.user?.id;

    if (!student_id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "answers are required",
      });
    }

    // prevent second submit if you want only one attempt
    const { data: existingAttempt } = await supabase
      .from("live_test_attempts")
      .select("id")
      .eq("live_test_id", id)
      .eq("student_id", student_id)
      .maybeSingle();

    if (existingAttempt) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted this live test",
      });
    }

    const { data: liveTest, error: liveTestError } = await supabase
      .from("live_tests")
      .select("*")
      .eq("id", id)
      .eq("status", "published")
      .eq("is_public", true)
      .single();

    if (liveTestError) throw liveTestError;

    const snapshot = liveTest.question_snapshot || [];
    const answerMap = new Map(
      answers.map((a) => [Number(a.question_id), Number(a.selected_option_id)])
    );

    let score = 0;
    for (const q of snapshot) {
      const selected = answerMap.get(Number(q.id));
      if (selected && Number(selected) === Number(q.correct_option_id)) {
        score += 1;
      }
    }

    const insertPayload = {
      live_test_id: Number(id),
      student_id: Number(student_id),
      answers,
      score,
      total_questions: liveTest.total_questions || 40,
    };

    const { data, error } = await supabase
      .from("live_test_attempts")
      .insert([insertPayload])
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Live test submitted successfully",
      data: {
        attempt_id: data.id,
        submitted_at: data.submitted_at,
      },
    });
  } catch (error) {
    console.error("submitLiveTest error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ADMIN: list all live tests
export const getAllLiveTestsAdmin = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("live_tests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Live tests fetched successfully",
      data: data || [],
    });
  } catch (error) {
    console.error("getAllLiveTestsAdmin error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ADMIN: results
export const getLiveTestResults = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("live_test_attempts")
      .select(`
        id,
        student_id,
        score,
        total_questions,
        submitted_at,
        users (
          id,
          user_name,
          email,
          mobile
        )
      `)
      .eq("live_test_id", id)
      .order("submitted_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Live test results fetched successfully",
      data: data || [],
    });
  } catch (error) {
    console.error("getLiveTestResults error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ADMIN: export results as excel
export const exportLiveTestResultsExcel = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: attempts, error } = await supabase
      .from("live_test_attempts")
      .select(`
        id,
        student_id,
        score,
        total_questions,
        submitted_at,
        users (
          id,
          user_name,
          email,
          mobile
        )
      `)
      .eq("live_test_id", id)
      .order("submitted_at", { ascending: false });

    if (error) throw error;

    const rows = (attempts || []).map((item, index) => ({
      SrNo: index + 1,
      StudentName: item.users?.user_name || "",
      Email: item.users?.email || "",
      Mobile: item.users?.mobile || "",
      Score: item.score,
      TotalQuestions: item.total_questions,
      Percentage: item.total_questions
        ? Number(((item.score / item.total_questions) * 100).toFixed(2))
        : 0,
      SubmittedAt: item.submitted_at,
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Live Test Results");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=live-test-${id}-results.xlsx`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    return res.send(buffer);
  } catch (error) {
    console.error("exportLiveTestResultsExcel error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};