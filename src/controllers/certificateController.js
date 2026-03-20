import { supabase } from "../config/supabaseClient.js";
import { generateCertificatePdfBuffer } from "../services/certificatePdf.js";
import { sendCertificateEmail } from "../services/certificateEmail.js";

export const sendCertificateController = async (req, res) => {
  try {
    const { userId, courseId } = req.body;

    if (!userId || !courseId) {
      return res.status(400).json({
        success: false,
        message: "userId and courseId are required",
      });
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, user_name, email")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id, course_name")
      .eq("id", courseId)
      .single();

    if (courseError || !course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const { data: existingCertificate, error: existingError } = await supabase
      .from("certificates")
      .select("id, certificate_number, status")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (existingError) {
      return res.status(500).json({
        success: false,
        message: "Failed to check existing certificate",
      });
    }

    if (existingCertificate) {
      return res.status(409).json({
        success: false,
        message: "Certificate already exists for this user and course",
        data: existingCertificate,
      });
    }

    const certificateNumber = `CERT-${Date.now()}`;
    const issueDate = new Date().toISOString().slice(0, 10);
    const fileName = `certificate-${certificateNumber}.pdf`;

    const pdfBuffer = await generateCertificatePdfBuffer({
      certificateNumber,
      issueDate,
      user: {
        name: user.user_name || user.email,
        email: user.email,
      },
      course: {
        name: course.course_name,
      },
    });

    const { data: certificateRow, error: insertError } = await supabase
      .from("certificates")
      .insert([
        {
          user_id: userId,
          course_id: courseId,
          certificate_number: certificateNumber,
          file_name: fileName,
          issued_by: req.user?.id || null,
          status: "generated",
        },
      ])
      .select()
      .single();

    if (insertError || !certificateRow) {
      return res.status(500).json({
        success: false,
        message: "Failed to store certificate record",
      });
    }

    try {
      await sendCertificateEmail({
        toEmail: user.email,
        toName: user.user_name || user.email,
        pdfBuffer,
        certificateNumber,
        courseName: course.course_name,
      });
    } catch (emailError) {
      await supabase
        .from("certificates")
        .update({
          status: "failed",
          error_message: emailError.message,
        })
        .eq("id", certificateRow.id);

      return res.status(500).json({
        success: false,
        message: "Certificate record saved but email sending failed",
        error: emailError.message,
      });
    }

    await supabase
      .from("certificates")
      .update({
        status: "sent",
        emailed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", certificateRow.id);

    return res.status(200).json({
      success: true,
      message: "Certificate sent successfully",
      data: {
        id: certificateRow.id,
        certificateNumber,
        user: {
          id: user.id,
          name: user.user_name,
          email: user.email,
        },
        course: {
          id: course.id,
          name: course.course_name,
        },
      },
    });
  } catch (err) {
    console.error("Send certificate error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to send certificate",
      error: err.message,
    });
  }
};

// GET /api/certificate?userId=1&courseId=2&status=sent
export const getCertificatesController = async (req, res) => {
  try {
    const { userId, courseId, status } = req.query;

    let query = supabase
      .from("certificates")
      .select(`
        id,
        user_id,
        course_id,
        certificate_number,
        file_name,
        issued_by,
        issued_at,
        emailed_at,
        status,
        error_message,
        users!certificates_user_id_fkey (
          id,
          user_name,
          email
        ),
        courses!certificates_course_id_fkey (
          id,
          course_name
        )
      `)
      .order("issued_at", { ascending: false });

    if (userId) {
      query = query.eq("user_id", userId);
    }

    if (courseId) {
      query = query.eq("course_id", courseId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Get certificates error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch certificates",
        error: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Certificates fetched successfully",
      data: data || [],
    });
  } catch (err) {
    console.error("Get certificates controller error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch certificates",
      error: err.message,
    });
  }
};

// GET /api/certificate/:id
export const getCertificateByIdController = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("certificates")
      .select(`
        id,
        user_id,
        course_id,
        certificate_number,
        file_name,
        issued_by,
        issued_at,
        emailed_at,
        status,
        error_message,
        users!certificates_user_id_fkey (
          id,
          user_name,
          email
        ),
        courses!certificates_course_id_fkey (
          id,
          course_name
        )
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Certificate fetched successfully",
      data,
    });
  } catch (err) {
    console.error("Get certificate by id error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch certificate",
      error: err.message,
    });
  }
};