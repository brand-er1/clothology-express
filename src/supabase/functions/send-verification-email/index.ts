
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailVerificationRequest {
  email: string;
  code: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, code }: EmailVerificationRequest = await req.json();

    const emailResponse = await resend.emails.send({
      from: "verification@your-domain.com",
      to: [email],
      subject: "이메일 인증 코드",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>이메일 인증</h1>
          <p>안녕하세요! 회원가입을 위한 이메일 인증 코드입니다:</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; font-size: 24px; letter-spacing: 4px; margin: 20px 0;">
            <strong>${code}</strong>
          </div>
          <p>인증 코드를 입력하여 이메일 인증을 완료해주세요.</p>
          <p>본인이 요청하지 않은 경우 이 메일을 무시해주세요.</p>
        </div>
      `,
    });

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
