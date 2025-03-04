
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { AuthFormData } from "@/types/auth";

export const useProfileForm = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [formData, setFormData] = useState<Partial<AuthFormData>>({
    username: "",
    fullName: "",
    phoneNumber: "",
    address: "",
    addressDetail: "",
    postcode: "",
    height: "",
    weight: "",
    gender: "남성",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleGenderChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      gender: value
    }));
  };

  const loadUserProfile = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      
      if (!user) {
        navigate("/auth");
        return;
      }

      setEmail(user.email || "");

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (profile) {
        const addressMatch = profile.address?.match(/^(.*?)\s*(?:\((.*?)\))?$/);
        const mainAddress = addressMatch?.[1] || "";
        const postcode = addressMatch?.[2] || "";
        
        const addressParts = mainAddress.trim().split(/\s+/);
        const addressDetail = addressParts.length > 1 ? addressParts.pop() : "";
        const baseAddress = addressParts.join(" ");

        setUserId(profile.user_id || "");
        setFormData({
          username: profile.username || "",
          fullName: profile.full_name || "",
          phoneNumber: profile.phone_number || "",
          address: baseAddress || "",
          addressDetail: addressDetail || "",
          postcode: postcode || "",
          height: profile.height?.toString() || "",
          weight: profile.weight?.toString() || "",
          gender: profile.gender || "남성",
        });
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      toast({
        title: "프로필 로드 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) throw new Error("로그인이 필요합니다.");

      const fullAddress = formData.addressDetail 
        ? `${formData.address} ${formData.addressDetail} (${formData.postcode})`
        : `${formData.address} (${formData.postcode})`;

      const { error } = await supabase
        .from('profiles')
        .update({
          username: formData.username,
          address: fullAddress,
          height: formData.height ? Number(formData.height) : null,
          weight: formData.weight ? Number(formData.weight) : null,
          gender: formData.gender,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "프로필 업데이트 성공",
        description: "프로필 정보가 성공적으로 수정되었습니다.",
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "프로필 업데이트 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUserProfile();
  }, []);

  return {
    isLoading,
    email,
    userId,
    formData,
    handleChange,
    handleGenderChange,
    handleSubmit
  };
};
