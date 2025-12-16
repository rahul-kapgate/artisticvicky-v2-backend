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
