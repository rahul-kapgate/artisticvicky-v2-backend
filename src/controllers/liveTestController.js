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
      start_at,
    } = req.body;

    if (!title || !course_id || !start_at) {
      return res.status(400).json({
        success: false,
        message: "title, course_id and start_at are required",
      });
    }

    const startDate = new Date(start_at);
    if (Number.isNaN(startDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid start_at",
      });
    }

    const endDate = new Date(startDate.getTime() + duration_minutes * 60 * 1000);

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
        message: "At least 40 questions are required",
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
      start_at: startDate.toISOString(),
      end_at: endDate.toISOString(),
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

    const { data: attempt, error: attemptError } = await supabase
      .from("live_test_attempts")
      .select("*")
      .eq("live_test_id", id)
      .eq("student_id", student_id)
      .maybeSingle();

    if (attemptError) throw attemptError;

    if (!attempt) {
      return res.status(400).json({
        success: false,
        message: "Live test not started yet",
      });
    }

    if (attempt.status === "submitted" || attempt.status === "auto_submitted") {
      return res.status(400).json({
        success: false,
        message: "This live test is already submitted",
      });
    }

    const now = new Date();
    const expiresAt = new Date(attempt.expires_at);
    const isExpired = now > expiresAt;

    const { data: liveTest, error: liveTestError } = await supabase
      .from("live_tests")
      .select("*")
      .eq("id", id)
      .single();

    if (liveTestError) throw liveTestError;

    const snapshot = liveTest.question_snapshot || [];
    const answerMap = new Map(
      (answers || []).map((a) => [
        Number(a.question_id),
        Number(a.selected_option_id),
      ])
    );

    let score = 0;
    for (const q of snapshot) {
      const selected = answerMap.get(Number(q.id));
      if (selected && Number(selected) === Number(q.correct_option_id)) {
        score += 1;
      }
    }

    const finalStatus = isExpired ? "auto_submitted" : "submitted";

    const { data, error } = await supabase
      .from("live_test_attempts")
      .update({
        answers: answers || [],
        score,
        status: finalStatus,
        submitted_at: now.toISOString(),
      })
      .eq("id", attempt.id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: isExpired
        ? "Time expired. Live test auto-submitted."
        : "Live test submitted successfully",
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

    const { data: attempts, error: attemptsError } = await supabase
      .from("live_test_attempts")
      .select(`
        id,
        student_id,
        score,
        total_questions,
        submitted_at
      `)
      .eq("live_test_id", id)
      .order("submitted_at", { ascending: false });

    if (attemptsError) throw attemptsError;

    if (!attempts || attempts.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Live test results fetched successfully",
        data: [],
      });
    }

    const studentIds = [
      ...new Set(
        attempts
          .map((item) => item.student_id)
          .filter((value) => value !== null && value !== undefined)
      ),
    ];

    let usersMap = new Map();

    if (studentIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, user_name, name, email, mobile")
        .in("id", studentIds);

      if (usersError) throw usersError;

      usersMap = new Map((users || []).map((user) => [user.id, user]));
    }

    const mergedResults = attempts.map((attempt) => ({
      ...attempt,
      users: usersMap.get(attempt.student_id) || null,
    }));

    return res.status(200).json({
      success: true,
      message: "Live test results fetched successfully",
      data: mergedResults,
    });
  } catch (error) {
    console.error("getLiveTestResults error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// ADMIN: export results as excel
export const exportLiveTestResultsExcel = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: attempts, error: attemptsError } = await supabase
      .from("live_test_attempts")
      .select(`
        id,
        student_id,
        score,
        total_questions,
        submitted_at
      `)
      .eq("live_test_id", id)
      .order("submitted_at", { ascending: false });

    if (attemptsError) throw attemptsError;

    const attemptList = attempts || [];

    const studentIds = [
      ...new Set(
        attemptList
          .map((item) => item.student_id)
          .filter((value) => value !== null && value !== undefined)
      ),
    ];

    let usersMap = new Map();

    if (studentIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, user_name, name, email, mobile")
        .in("id", studentIds);

      if (usersError) throw usersError;

      usersMap = new Map((users || []).map((user) => [user.id, user]));
    }

    const rows = attemptList.map((item, index) => {
      const user = usersMap.get(item.student_id);

      return {
        SrNo: index + 1,
        StudentName: user?.user_name || user?.name || "",
        Email: user?.email || "",
        Mobile: user?.mobile || "",
        Score: item.score,
        TotalQuestions: item.total_questions,
        Percentage: item.total_questions
          ? Number(((item.score / item.total_questions) * 100).toFixed(2))
          : 0,
        SubmittedAt: item.submitted_at || "",
      };
    });

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
      message: error.message || "Internal server error",
    });
  }
};

export const startLiveTest = async (req, res) => {
  try {
    const { id } = req.params;
    const student_id = req.user?.id;

    if (!student_id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { data: liveTest, error: testError } = await supabase
      .from("live_tests")
      .select("*")
      .eq("id", id)
      .eq("status", "published")
      .eq("is_public", true)
      .single();

    if (testError || !liveTest) {
      return res.status(404).json({
        success: false,
        message: "Live test not found",
      });
    }

    const now = new Date();
    const startAt = new Date(liveTest.start_at);
    const endAt = new Date(liveTest.end_at);

    if (now < startAt) {
      return res.status(400).json({
        success: false,
        message: "Live test has not started yet",
        data: {
          start_at: liveTest.start_at,
          server_now: now.toISOString(),
        },
      });
    }

    if (now > endAt) {
      return res.status(400).json({
        success: false,
        message: "Live test has already ended",
      });
    }

    // Resume existing attempt if present
    const { data: existingAttempt } = await supabase
      .from("live_test_attempts")
      .select("*")
      .eq("live_test_id", id)
      .eq("student_id", student_id)
      .in("status", ["in_progress", "submitted", "auto_submitted"])
      .maybeSingle();

    if (existingAttempt) {
      const expiresAt = new Date(existingAttempt.expires_at);
      const remainingSeconds = Math.max(
        0,
        Math.floor((expiresAt.getTime() - now.getTime()) / 1000)
      );

      return res.status(200).json({
        success: true,
        message: "Live test session fetched successfully",
        data: {
          attempt_id: existingAttempt.id,
          server_now: now.toISOString(),
          started_at: existingAttempt.started_at,
          expires_at: existingAttempt.expires_at,
          remaining_seconds: remainingSeconds,
          status: existingAttempt.status,
          test: {
            id: liveTest.id,
            title: liveTest.title,
            description: liveTest.description,
            duration_minutes: liveTest.duration_minutes,
            total_questions: liveTest.total_questions,
            questions: sanitizeQuestionsForStudent(liveTest.question_snapshot),
          },
        },
      });
    }

    const calculatedExpiry = new Date(
      now.getTime() + liveTest.duration_minutes * 60 * 1000
    );

    const expiresAt =
      calculatedExpiry > endAt ? endAt : calculatedExpiry;

    const { data: attempt, error: attemptError } = await supabase
      .from("live_test_attempts")
      .insert([
        {
          live_test_id: Number(id),
          student_id: Number(student_id),
          answers: [],
          score: 0,
          total_questions: liveTest.total_questions || 40,
          started_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          status: "in_progress",
        },
      ])
      .select()
      .single();

    if (attemptError) throw attemptError;

    const remainingSeconds = Math.max(
      0,
      Math.floor((expiresAt.getTime() - now.getTime()) / 1000)
    );

    return res.status(200).json({
      success: true,
      message: "Live test started successfully",
      data: {
        attempt_id: attempt.id,
        server_now: now.toISOString(),
        started_at: attempt.started_at,
        expires_at: attempt.expires_at,
        remaining_seconds: remainingSeconds,
        status: attempt.status,
        test: {
          id: liveTest.id,
          title: liveTest.title,
          description: liveTest.description,
          duration_minutes: liveTest.duration_minutes,
          total_questions: liveTest.total_questions,
          questions: sanitizeQuestionsForStudent(liveTest.question_snapshot),
        },
      },
    });
  } catch (error) {
    console.error("startLiveTest error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getLiveTestSession = async (req, res) => {
  try {
    const { id } = req.params;
    const student_id = req.user?.id;

    if (!student_id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // get live test
    const { data: liveTest, error: liveTestError } = await supabase
      .from("live_tests")
      .select("*")
      .eq("id", id)
      .eq("status", "published")
      .eq("is_public", true)
      .single();

    if (liveTestError || !liveTest) {
      return res.status(404).json({
        success: false,
        message: "Live test not found",
      });
    }

    // get student attempt
    const { data: attempt, error: attemptError } = await supabase
      .from("live_test_attempts")
      .select("*")
      .eq("live_test_id", id)
      .eq("student_id", student_id)
      .maybeSingle();

    if (attemptError) throw attemptError;

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "No active session found for this live test",
      });
    }

    const now = new Date();
    const expiresAt = new Date(attempt.expires_at);
    let remainingSeconds = Math.max(
      0,
      Math.floor((expiresAt.getTime() - now.getTime()) / 1000)
    );

    let currentStatus = attempt.status;

    // auto-expire if time is over and not submitted yet
    if (
      remainingSeconds === 0 &&
      attempt.status !== "submitted" &&
      attempt.status !== "auto_submitted" &&
      attempt.status !== "expired"
    ) {
      const { data: updatedAttempt, error: updateError } = await supabase
        .from("live_test_attempts")
        .update({
          status: "expired",
        })
        .eq("id", attempt.id)
        .select()
        .single();

      if (updateError) throw updateError;

      currentStatus = updatedAttempt.status;
    }

    return res.status(200).json({
      success: true,
      message: "Live test session fetched successfully",
      data: {
        attempt_id: attempt.id,
        server_now: now.toISOString(),
        started_at: attempt.started_at,
        expires_at: attempt.expires_at,
        remaining_seconds: remainingSeconds,
        status: currentStatus,
        answers: attempt.answers || [],
        test: {
          id: liveTest.id,
          title: liveTest.title,
          description: liveTest.description,
          duration_minutes: liveTest.duration_minutes,
          total_questions: liveTest.total_questions,
          start_at: liveTest.start_at,
          end_at: liveTest.end_at,
          questions: sanitizeQuestionsForStudent(
            liveTest.question_snapshot || []
          ),
        },
      },
    });
  } catch (error) {
    console.error("getLiveTestSession error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};