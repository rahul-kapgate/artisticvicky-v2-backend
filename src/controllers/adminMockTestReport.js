import { supabase } from "../config/supabaseClient.js";

export const getMockTestScore = async (req, res) => {
    try {
        const { student_Id, course_Id } = req.body;

        // ✅ Validation
        if (!student_Id || !course_Id) {
            return res.status(400).json({
                success: false,
                message: "student_Id and course_Id are required",
            });
        }

        // ✅ Fetch data
        const { data: score, error: fetchError } = await supabase
            .from("mock_attempts")
            .select("score, submitted_at")
            .eq("course_id", course_Id)
            .eq("student_id", student_Id);


        if (fetchError) throw fetchError;

        // ✅ No attempts
        if (!score || score.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No mock test attempts found",
                data: [],
            });
        }

        // ✅ Success response
        res.status(200).json({
            success: true,
            message: "Mock test score fetched successfully",
            data: score,
        })
    } catch (error) {
        console.log(error)
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

export const getPyqTestData = async (req, res) => {
    try {
        const { student_Id } = req.body;

        // ✅ Validation
        if (!student_Id) {
            return res.status(400).json({
                success: false,
                message: "student_Id is required",
            });
        }

        // ✅ Fetch data
        const { data: score, error: fetchError } = await supabase
            .from("pyq_attempts")
            .select(`
    id,
    score,
    submitted_at,
    paper_id,
    pyq_papers (
      year,
      exam_day,
      course_id
    )
  `)
            .eq("student_id", student_Id);



        if (fetchError) {
            throw fetchError;
        }

        // ✅ Optional: handle no data case
        if (!score || score.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No PYQ attempts found for this student",
                data: [],
            });
        }

        // ✅ Success response
        return res.status(200).json({
            success: true,
            message: "PYQ test score fetched successfully",
            data: score,
        });

    } catch (error) {
        console.error("getPyqTestData error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const getMockTestSummary = async (req, res) => {
  try {
    const { student_Id, course_Id } = req.body;

    // ✅ Validation
    if (!student_Id || !course_Id) {
      return res.status(400).json({
        success: false,
        message: "student_Id and course_Id are required",
      });
    }

    const parsedStudentId = Number(student_Id);
    const parsedCourseId = Number(course_Id);

    if (Number.isNaN(parsedStudentId) || Number.isNaN(parsedCourseId)) {
      return res.status(400).json({
        success: false,
        message: "student_Id and course_Id must be valid numbers",
      });
    }

const { data: courseData, error: courseError } = await supabase
  .from("courses")
  .select("id, students_enrolled")
  .in("id", [1, 12]);

if (courseError) {
  throw courseError;
}

const isEnrolled = (courseData || []).some((course) => {
  const enrolledStudents = Array.isArray(course.students_enrolled)
    ? course.students_enrolled
    : [];

  return enrolledStudents.some((id) => Number(id) === parsedStudentId);
});

    // ✅ 2. Get total mock test count
    const { count, error: countError } = await supabase
      .from("mock_attempts")
      .select("id", { count: "exact", head: true })
      .eq("course_id", parsedCourseId)
      .eq("student_id", parsedStudentId);

    if (countError) {
      throw countError;
    }

    // ✅ 3. Get last 3 timestamps
    const { data: lastAttempts, error: attemptsError } = await supabase
      .from("mock_attempts")
      .select("submitted_at")
      .eq("course_id", parsedCourseId)
      .eq("student_id", parsedStudentId)
      .order("submitted_at", { ascending: false })
      .limit(3);

    if (attemptsError) {
      throw attemptsError;
    }

    return res.status(200).json({
      success: true,
      message: "Mock test summary fetched successfully",
      data: {
        student_id: parsedStudentId,
        course_id: parsedCourseId,
        mock_test_count: count || 0,
        last_3_attempt_timestamps: lastAttempts?.map(
          (item) => item.submitted_at
        ) || [],
        is_enrolled: isEnrolled,
      },
    });
  } catch (error) {
    console.error("getMockTestSummary error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
