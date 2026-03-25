import XLSX from "xlsx";
import { supabase } from "../config/supabaseClient.js";

const sanitizeQuestionsForStudent = (questions = []) =>
  questions.map((q) => ({
    id: q.id,
    question_text: q.question_text,
    options: q.options,
    difficulty: q.difficulty ?? null,
    image_url: q.image_url ?? null,
  }));

const nowIso = () => new Date().toISOString();

const getUserIdFromReq = (req) => {
  return req.user?.id || req.user?.userId || null;
};

const shuffleArray = (arr = []) => {
  const copy = [...arr];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
};

/* =========================
   ADMIN: CREATE LIVE TEST
   default: draft + not published
========================= */
export const createLiveTest = async (req, res) => {
  try {
    const adminId = getUserIdFromReq(req);

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

    const parsedDuration = Number(duration_minutes);
    if (!parsedDuration || parsedDuration <= 0) {
      return res.status(400).json({
        success: false,
        message: "duration_minutes must be greater than 0",
      });
    }

    const startAtDate = new Date(start_at);
    if (Number.isNaN(startAtDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid start_at",
      });
    }

    const endAtDate = new Date(
      startAtDate.getTime() + parsedDuration * 60 * 1000,
    );

    const { data: allQuestions, error: questionsError } = await supabase
      .from("mock_questions")
      .select("*")
      .eq("course_id", course_id);

    if (questionsError) throw questionsError;

    if (!allQuestions || allQuestions.length < 40) {
      return res.status(400).json({
        success: false,
        message: "At least 40 questions are required to create a live test",
      });
    }

    const questions = shuffleArray(allQuestions).slice(0, 40);

    const payload = {
      title: title.trim(),
      description: description?.trim?.() || "",
      course_id: Number(course_id),
      duration_minutes: parsedDuration,
      total_questions: 40,
      status: "draft",
      is_public: false,
      start_at: startAtDate.toISOString(),
      end_at: endAtDate.toISOString(),
      question_ids: questions.map((q) => q.id),
      question_snapshot: questions,
      created_by: adminId,
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
      message: error.message || "Internal server error",
    });
  }
};

/* =========================
   ADMIN: PUBLISH
========================= */
export const publishLiveTest = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabase
      .from("live_tests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({
        success: false,
        message: "Live test not found",
      });
    }

    if (!existing.start_at || !existing.end_at) {
      return res.status(400).json({
        success: false,
        message: "start_at and end_at are required before publishing",
      });
    }

    const snapshot = existing.question_snapshot || [];
    if (snapshot.length < 40) {
      return res.status(400).json({
        success: false,
        message: "Live test must contain 40 questions before publishing",
      });
    }

    const { data, error } = await supabase
      .from("live_tests")
      .update({
        status: "published",
        is_public: true,
        published_at: nowIso(),
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
      message: error.message || "Internal server error",
    });
  }
};

/* =========================
   ADMIN: UNPUBLISH
========================= */
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
      message: error.message || "Internal server error",
    });
  }
};

/* =========================
   PUBLIC: ONLY PUBLISHED + NOT ENDED
========================= */
export const getPublicLiveTests = async (req, res) => {
  try {
    const currentTime = nowIso();

    const { data, error } = await supabase
      .from("live_tests")
      .select(
        `
        id,
        title,
        description,
        course_id,
        duration_minutes,
        total_questions,
        start_at,
        end_at,
        published_at
      `,
      )
      .eq("is_public", true)
      .eq("status", "published")
      .gt("end_at", currentTime)
      .order("start_at", { ascending: true });

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
      message: error.message || "Internal server error",
    });
  }
};

/* =========================
   STUDENT: START LIVE TEST
   fixed window flow:
   expires_at = liveTest.end_at
========================= */
export const startLiveTest = async (req, res) => {
  try {
    const { id } = req.params;
    const studentId = getUserIdFromReq(req);

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { data: liveTest, error: testError } = await supabase
      .from("live_tests")
      .select("*")
      .eq("id", id)
      .eq("is_public", true)
      .eq("status", "published")
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
          server_now: now.toISOString(),
          start_at: liveTest.start_at,
          end_at: liveTest.end_at,
        },
      });
    }

    if (now >= endAt) {
      return res.status(400).json({
        success: false,
        message: "Live test has already ended",
      });
    }

    const { data: existingAttempt, error: existingError } = await supabase
      .from("live_test_attempts")
      .select("*")
      .eq("live_test_id", id)
      .eq("student_id", studentId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingAttempt) {
      const expiresAt = new Date(existingAttempt.expires_at || liveTest.end_at);
      const remainingSeconds = Math.max(
        0,
        Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
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
          answers: existingAttempt.answers || [],
          test: {
            id: liveTest.id,
            title: liveTest.title,
            description: liveTest.description,
            duration_minutes: liveTest.duration_minutes,
            total_questions: liveTest.total_questions,
            start_at: liveTest.start_at,
            end_at: liveTest.end_at,
            questions: sanitizeQuestionsForStudent(
              liveTest.question_snapshot || [],
            ),
          },
        },
      });
    }

    const { data: attempt, error: attemptError } = await supabase
      .from("live_test_attempts")
      .insert([
        {
          live_test_id: Number(id),
          student_id: Number(studentId),
          answers: [],
          score: 0,
          total_questions: Number(liveTest.total_questions || 40),
          started_at: now.toISOString(),
          expires_at: liveTest.end_at,
          status: "in_progress",
        },
      ])
      .select()
      .single();

    if (attemptError) throw attemptError;

    const remainingSeconds = Math.max(
      0,
      Math.floor((new Date(liveTest.end_at).getTime() - now.getTime()) / 1000),
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
            liveTest.question_snapshot || [],
          ),
        },
      },
    });
  } catch (error) {
    console.error("startLiveTest error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/* =========================
   STUDENT: GET SESSION
========================= */
export const getLiveTestSession = async (req, res) => {
  try {
    const { id } = req.params;
    const studentId = getUserIdFromReq(req);

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { data: liveTest, error: liveTestError } = await supabase
      .from("live_tests")
      .select("*")
      .eq("id", id)
      .eq("is_public", true)
      .eq("status", "published")
      .single();

    if (liveTestError || !liveTest) {
      return res.status(404).json({
        success: false,
        message: "Live test not found",
      });
    }

    const { data: attempt, error: attemptError } = await supabase
      .from("live_test_attempts")
      .select("*")
      .eq("live_test_id", id)
      .eq("student_id", studentId)
      .maybeSingle();

    if (attemptError) throw attemptError;

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "No active session found for this live test",
      });
    }

    const now = new Date();
    const expiresAt = new Date(attempt.expires_at || liveTest.end_at);
    let remainingSeconds = Math.max(
      0,
      Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
    );
    let currentStatus = attempt.status;

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
            liveTest.question_snapshot || [],
          ),
        },
      },
    });
  } catch (error) {
    console.error("getLiveTestSession error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/* =========================
   STUDENT: SUBMIT
========================= */
export const submitLiveTest = async (req, res) => {
  try {
    const { id } = req.params;
    const { answers = [] } = req.body;
    const studentId = getUserIdFromReq(req);

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { data: attempt, error: attemptError } = await supabase
      .from("live_test_attempts")
      .select("*")
      .eq("live_test_id", id)
      .eq("student_id", studentId)
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

    const { data: liveTest, error: liveTestError } = await supabase
      .from("live_tests")
      .select("*")
      .eq("id", id)
      .single();

    if (liveTestError || !liveTest) {
      return res.status(404).json({
        success: false,
        message: "Live test not found",
      });
    }

    const now = new Date();
    const expiresAt = new Date(attempt.expires_at || liveTest.end_at);
    const isExpired = now >= expiresAt;

    const answerMap = new Map(
      (answers || []).map((a) => [
        Number(a.question_id),
        Number(a.selected_option_id),
      ]),
    );

    const snapshot = liveTest.question_snapshot || [];

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
        submitted_at: now.toISOString(),
        status: finalStatus,
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
      message: error.message || "Internal server error",
    });
  }
};

/* =========================
   ADMIN: ALL LIVE TESTS
========================= */
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
      message: error.message || "Internal server error",
    });
  }
};

/* =========================
   ADMIN: RESULTS
   manual join with users
========================= */
export const getLiveTestResults = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: attempts, error: attemptsError } = await supabase
      .from("live_test_attempts")
      .select(
        `
        id,
        student_id,
        score,
        total_questions,
        submitted_at,
        status
      `,
      )
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
          .filter((value) => value !== null && value !== undefined),
      ),
    ];

    let usersMap = new Map();

    if (studentIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, user_name, email, mobile")
        .in("id", studentIds);

      if (usersError) throw usersError;

      usersMap = new Map(
        (users || []).map((user) => [
          user.id,
          {
            ...user,
            name: user.user_name || "",
          },
        ]),
      );
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

/* =========================
   ADMIN: EXPORT EXCEL
========================= */
export const exportLiveTestResultsExcel = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: attempts, error: attemptsError } = await supabase
      .from("live_test_attempts")
      .select(
        `
        id,
        student_id,
        score,
        total_questions,
        submitted_at,
        status
      `,
      )
      .eq("live_test_id", id)
      .order("submitted_at", { ascending: false });

    if (attemptsError) throw attemptsError;

    const attemptList = attempts || [];

    const studentIds = [
      ...new Set(
        attemptList
          .map((item) => item.student_id)
          .filter((value) => value !== null && value !== undefined),
      ),
    ];

    let usersMap = new Map();

    if (studentIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, user_name, email, mobile")
        .in("id", studentIds);

      if (usersError) throw usersError;

      usersMap = new Map(
        (users || []).map((user) => [
          user.id,
          {
            ...user,
            name: user.user_name || "",
          },
        ]),
      );
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
        Status: item.status || "",
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
      `attachment; filename=live-test-${id}-results.xlsx`,
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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

const normalizeOptions = (options = []) => {
  if (!Array.isArray(options)) return [];

  return options.map((opt, index) => {
    if (typeof opt === "string" || typeof opt === "number") {
      return {
        id: index + 1,
        text: String(opt),
      };
    }

    return {
      id: Number(
        opt?.id ?? opt?.option_id ?? opt?.value ?? opt?.key ?? index + 1,
      ),
      text:
        opt?.text ??
        opt?.option_text ??
        opt?.label ??
        opt?.value ??
        opt?.title ??
        "",
    };
  });
};

const getCorrectAnswerText = (question) => {
  const options = normalizeOptions(question?.options || []);
  const correctId = Number(question?.correct_option_id);

  const matched = options.find((opt) => Number(opt.id) === correctId);
  if (matched) return matched.text;

  // fallback: if correct_option_id is 1-based position
  if (correctId > 0 && options[correctId - 1]) {
    return options[correctId - 1].text;
  }

  return "";
};

/* =========================
   ADMIN: EXPORT QUESTIONS + ANSWERS EXCEL
========================= */
export const exportLiveTestQuestionsExcel = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: liveTest, error: liveTestError } = await supabase
      .from("live_tests")
      .select("id, title, question_snapshot, question_ids")
      .eq("id", id)
      .single();

    if (liveTestError || !liveTest) {
      return res.status(404).json({
        success: false,
        message: "Live test not found",
      });
    }

    let questions = Array.isArray(liveTest.question_snapshot)
      ? liveTest.question_snapshot
      : [];

    // fallback if snapshot is empty
    if (
      questions.length === 0 &&
      Array.isArray(liveTest.question_ids) &&
      liveTest.question_ids.length > 0
    ) {
      const { data: fetchedQuestions, error: questionsError } = await supabase
        .from("mock_questions")
        .select("*")
        .in("id", liveTest.question_ids)
        .order("id", { ascending: true });

      if (questionsError) throw questionsError;

      questions = fetchedQuestions || [];
    }

    if (!questions.length) {
      return res.status(400).json({
        success: false,
        message: "No questions found for this live test",
      });
    }

    const rows = questions.map((q, index) => {
      const options = normalizeOptions(q.options || []);

      return {
        SrNo: index + 1,
        QuestionId: q.id ?? "",
        Question: q.question_text ?? "",
        Option1: options[0]?.text ?? "",
        Option2: options[1]?.text ?? "",
        Option3: options[2]?.text ?? "",
        Option4: options[3]?.text ?? "",
        AllOptions: options
          .map((opt, i) => `${i + 1}. ${opt.text}`)
          .join(" | "),
        CorrectOptionId: q.correct_option_id ?? "",
        CorrectAnswer: getCorrectAnswerText(q),
        Difficulty: q.difficulty ?? "",
        ImageUrl: q.image_url ?? "",
      };
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);

    XLSX.utils.book_append_sheet(workbook, worksheet, "Questions Answer Key");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=live-test-${id}-questions-answer-key.xlsx`,
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    return res.send(buffer);
  } catch (error) {
    console.error("exportLiveTestQuestionsExcel error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};
