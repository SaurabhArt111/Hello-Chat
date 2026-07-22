import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser, registerUser } from "../api/auth";
import { useEffect } from "react";
import { useToastContext } from "../context/ToastContext";


const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");

  const navigate = useNavigate();
  const toast = useToastContext();

  /* HANDLE AVATAR */
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const userStr = localStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : null;
    if (user?.role === "admin") {
      navigate("/admin/dashboard", { replace: true });
    } else {
      navigate("/home", { replace: true });
    }
  }, [navigate]);


  /* SUBMIT */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const res = await loginUser({
          emailOrUsername,
          password,
        });

        const loggedInUser = res.data.user;

        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(loggedInUser));

        if (loggedInUser?.role === "admin") {
          navigate("/admin/dashboard");
        } else {
          navigate("/home");
        }
      } else {
        const formData = new FormData();

        formData.append("username", username);
        formData.append("email", email);
        formData.append("password", password);
        formData.append("bio", bio);
        formData.append("preferredLanguage", "English");

        if (avatarFile) {
          formData.append("avatar", avatarFile);
        }

        await registerUser(formData);

        toast.success("Registered successfully. Please login.");
        setIsLogin(true);
        setEmail("");
        setUsername("");
        setPassword("");
        setBio("");
        setAvatarFile(null);
        setAvatarPreview(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute top-0 left-0 w-full h-full object-cover"
      >
        <source src="/bg.mp4" type="video/mp4" />
      </video>

      {/* Overlay */}
      <div className="absolute w-full h-full bg-black/40"></div>

      {/* Auth Box */}
      <div className="relative z-10 flex items-center justify-center h-full">
        <div className="backdrop-blur-xl bg-white/90 dark:bg-neutral-800/90 border border-gray-200 dark:border-neutral-700 shadow-2xl p-8 md:p-10 rounded-2xl w-[90%] sm:w-[400px] md:w-[450px]">

          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-neutral-100 text-center mb-2">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h1>

          <p className="text-center text-gray-500 dark:text-neutral-400 mb-6">
            {isLogin ? "Login to continue" : "Join the messenger"}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 items-center">

            {/* Avatar Upload */}
            {!isLogin && (
              <div className="flex flex-col items-center mb-2">
                <label className="cursor-pointer">
                  <div className="w-24 h-24 rounded-2xl bg-gray-100 dark:bg-neutral-700 flex items-center justify-center overflow-hidden border-2 border-gray-300 dark:border-neutral-600 hover:border-emerald-500 transition-colors">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-500 dark:text-neutral-400 text-sm">Upload</span>
                    )}
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Login */}
            {isLogin && (
              <input
                type="text"
                placeholder="Email or Username"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                className="p-3.5 rounded-full bg-gray-100 dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 text-gray-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-400 outline-none w-full focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            )}

            {/* Register */}
            {!isLogin && (
              <>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="p-3.5 rounded-full bg-gray-100 dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 text-gray-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-400 outline-none w-full focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />

                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="p-3.5 rounded-full bg-gray-100 dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 text-gray-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-400 outline-none w-full focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </>
            )}

            {/* Password */}
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="p-3.5 rounded-full bg-gray-100 dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 text-gray-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-400 outline-none w-full focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />

            {/* Bio */}
            {!isLogin && (
              <textarea
                placeholder="Bio"
                rows="2"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="p-3.5 rounded-2xl bg-gray-100 dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 text-gray-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-400 outline-none resize-none w-full focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-neutral-600 disabled:cursor-not-allowed text-white p-3.5 rounded-xl font-semibold transition-all mt-2 w-full flex items-center justify-center gap-2 active:scale-95"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{isLogin ? "Logging in..." : "Registering..."}</span>
                </>
              ) : (
                <span>{isLogin ? "Login" : "Register"}</span>
              )}
            </button>
          </form>

          {/* Toggle */}
          <p className="text-center text-neutral-400 mt-6 text-sm">
            {isLogin ? "Don’t have an account?" : "Already have an account?"}{" "}
            <span
              onClick={() => setIsLogin(!isLogin)}
              className="font-semibold text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 cursor-pointer transition-colors"
            >
              {isLogin ? "Register" : "Login"}
            </span>
          </p>

        </div>
      </div>
    </div>
  );
};

export default Auth;
