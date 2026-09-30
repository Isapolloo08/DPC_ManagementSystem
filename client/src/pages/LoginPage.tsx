import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { ChurchLogo } from "../components/common/ChurchLogo";
import { WindowControls } from "../components/layout/WindowControls";
import { ThemeSelector } from "../components/common/ThemeSelector";
import {
  Lock, Mail, ArrowRight, ShieldCheck,
  Users, CheckCircle2, AlertCircle, Heart, MapPin, BookOpen, UserPlus, LogIn, AtSign, X, ShieldAlert, KeyRound, Eye, EyeOff
} from "lucide-react";

import churchBuildingImg from "../assets/dpc_church_building.jpg";
import youthImg from "../assets/Youth Ministry/714759264_1015627274136826_7581065074620186600_n.jpg";
import youngAdultImg from "../assets/Young Adult Ministry/690603367_927892950249367_8826331412381259866_n.jpg";
import highSchoolImg from "../assets/High School Ministry/796527703_1048178428038559_3748025892055604993_n.jpg";
import elementaryImg from "../assets/Elementary Ministry/737422339_874215309095466_1606506382904725503_n.jpg";
import kinderImg from "../assets/Kinder Ministry/728951324_122175506078930669_1302733184598992361_n.jpg";
import juniorAdultImg from "../assets/Junior Adult Minitry/724203661_994313309635368_1473330047075204322_n.jpg";
import oldAdultImg from "../assets/Old Adult Ministry/724408784_122172253130944863_6588021141249655795_n.jpg";

// Auto-cycling 5-second carousel slides showcasing all 7 church ministries & center
const CAROUSEL_SLIDES = [
  {
    image: churchBuildingImg,
    tag: "Daet, Camarines Norte, Philippines",
    title: "Daet Presbyterian Church",
    subtitle: "A Christ-Centered Community of Faith",
    verse: '"So we, though many, are one body in Christ."',
    citation: "Romans 12:5 • Nurturing faith, multi-generational households, Sunday security kiosks, and discipleship fellowships."
  },
  {
    image: youthImg,
    tag: "Youth Ministry (17-21 yrs)",
    title: "Youth Ministry",
    subtitle: "Life Groups & Biblical Training",
    verse: '"Don\'t let anyone look down on you because you are young, but set an example."',
    citation: "1 Timothy 4:12 • Empowering discipleship life groups and youth leadership rooted in Scripture."
  },
  {
    image: youngAdultImg,
    tag: "Young Adult Ministry (22-35 yrs)",
    title: "Young Adult Discipleship",
    subtitle: "Marketplace & Life Ministry",
    verse: '"Be strong and courageous. Do not be afraid; do not be discouraged."',
    citation: "Joshua 1:9 • Equipping young professionals and leaders for Kingdom impact."
  },
  {
    image: highSchoolImg,
    tag: "High School Ministry (13-16 yrs)",
    title: "High School Life Groups",
    subtitle: "Foundations of Faith",
    verse: '"Remember your Creator in the days of your youth."',
    citation: "Ecclesiastes 12:1 • Guiding teens in godly wisdom, identity, and Christ-centered friendship."
  },
  {
    image: elementaryImg,
    tag: "Elementary Ministry (6-12 yrs)",
    title: "Elementary Kids Church",
    subtitle: "Bible Adventures & Praise",
    verse: '"Train up a child in the way he should go; even when he is old he will not depart from it."',
    citation: "Proverbs 22:6 • Inspiring children with biblical foundations and joyful worship."
  },
  {
    image: kinderImg,
    tag: "Kinder Ministry (5 yrs)",
    title: "Kinder Lambs of Jesus",
    subtitle: "Early Seeds of Faith",
    verse: '"Let the little children come to me, and do not hinder them, for the kingdom of God belongs to such as these."',
    citation: "Mark 10:14 • Loving early childhood spiritual nurturing in a safe, warm environment."
  },
  {
    image: juniorAdultImg,
    tag: "Junior Adult Ministry",
    title: "Junior Adult Fellowship",
    subtitle: "Family & Marketplace Leaders",
    verse: '"As for me and my household, we will serve the LORD."',
    citation: "Joshua 24:15 • Building strong Christ-centered homes and active church servants."
  },
  {
    image: oldAdultImg,
    tag: "Old Adult Ministry",
    title: "Senior Golden Fellowship",
    subtitle: "Wisdom, Prayer & Heritage",
    verse: '"The righteous will flourish like a palm tree... they will still bear fruit in old age."',
    citation: "Psalm 92:12-14 • Honoring our church elders and prayer warriors who mentor the next generations."
  }
];

interface MinistrySummary {
  id: number;
  name: string;
  active_members_count?: number;
}

export const LoginPage: React.FC = () => {
  const { login, register, switchDemoUser, demoUsers, hasUsers, hasAdmin, loading: authLoading } = useAuth();
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [ministries, setMinistries] = useState<MinistrySummary[]>([]);
  const [loadingMinistries, setLoadingMinistries] = useState(false);

  // Login form state
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Admin Setup Modal form state
  const [adminName, setAdminName] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminConfirmPassword, setAdminConfirmPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showAdminConfirmPassword, setShowAdminConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch all active ministries dynamically from backend
  React.useEffect(() => {
    const fetchMinistries = async () => {
      try {
        setLoadingMinistries(true);
        const data = await api.getMinistries();
        setMinistries(data);
      } catch (err) {
        console.error("Failed to load ministries:", err);
      } finally {
        setLoadingMinistries(false);
      }
    };

    fetchMinistries();
  }, []);

  // Only an entirely empty installation may create the initial Admin publicly.
  React.useEffect(() => {
    if (!authLoading && !hasUsers) {
      setShowAdminModal(true);
    }
  }, [authLoading, hasUsers]);

  // Preload all carousel images into browser cache for instant, zero-flicker transitions
  React.useEffect(() => {
    CAROUSEL_SLIDES.forEach((slide) => {
      const img = new Image();
      img.src = slide.image;
    });
  }, []);

  // Auto-cycle carousel every 5 seconds
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % CAROUSEL_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrUsername.trim()) {
      setError("Please enter your email or username.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await login(emailOrUsername.trim(), password || "password123");
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please verify your email/username and password.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName.trim()) {
      setAdminError("Please enter your full name.");
      return;
    }
    if (!adminEmail.trim()) {
      setAdminError("Please enter your email address.");
      return;
    }
    if (!adminPassword || adminPassword.length < 6) {
      setAdminError("Password must be at least 6 characters.");
      return;
    }
    if (adminPassword !== adminConfirmPassword) {
      setAdminError("Passwords do not match.");
      return;
    }

    try {
      setSubmitting(true);
      setAdminError(null);
      const res = await register({
        name: adminName.trim(),
        username: adminUsername.trim() || undefined,
        email: adminEmail.trim(),
        password: adminPassword.trim()
      });
      if (res.isFirstUser) {
        setSuccessMsg("Master Administrator account created! Logging you in...");
      }
      setShowAdminModal(false);
    } catch (err: any) {
      setAdminError(err.message || "Failed to create administrator account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async (userId: number) => {
    try {
      setSubmitting(true);
      setError(null);
      await switchDemoUser(userId);
    } catch (err: any) {
      setError(err.message || "Failed to log in with demo account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-white relative">
      {/* Top draggable strip and window controls for desktop app */}
      <div
        className="fixed top-0 left-0 right-0 h-11 z-50 pointer-events-none flex items-center justify-end px-3 select-none"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <div className="pointer-events-auto bg-white/90 backdrop-blur-md border border-gray-300/80 rounded-xl shadow-xs p-0.5 flex items-center">
          <WindowControls
            className="flex items-center gap-0.5"
            buttonClassName="w-8 h-8 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-gray-200 active:bg-gray-300 transition-all cursor-pointer flex items-center justify-center"
            closeButtonClassName="w-8 h-8 rounded-lg text-slate-700 hover:text-white hover:bg-rose-600 active:bg-rose-700 transition-all cursor-pointer flex items-center justify-center group"
          />
        </div>
      </div>

      {/* LEFT SIDE: Church Identity Picture Carousel & Scripture (Responsive for Mobile, Tablet, Desktop) */}
      <div className="w-full md:w-1/2 lg:w-7/12 relative min-h-[280px] sm:min-h-[340px] md:min-h-screen bg-indigo-950 flex flex-col justify-between p-5 sm:p-8 md:p-10 lg:p-14 text-white overflow-hidden shrink-0">

        {/* Full-bleed background carousel images with buttery smooth cross-fade and zoom */}
        {CAROUSEL_SLIDES.map((slide, idx) => (
          <div
            key={idx}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              currentSlide === idx ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <div
              className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-[6000ms] ease-out will-change-transform ${
                currentSlide === idx ? "scale-105" : "scale-100"
              }`}
              style={{ backgroundImage: `url('${slide.image}')` }}
            />
          </div>
        ))}

        {/* Cinematic Vignette Gradient Overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(to top, rgba(15, 23, 42, 0.92) 0%, rgba(30, 41, 75, 0.60) 45%, rgba(15, 23, 42, 0.40) 100%)"
          }}
        />
        <div className="absolute inset-0 bg-black/20 pointer-events-none" />

        {/* Top Church Identity Header (Stable Anchor) */}
        <div className="relative z-10 animate-fade-slide-up flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <ChurchLogo className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl ring-2 ring-white/30 shadow-lg animate-float-gentle shrink-0 object-contain" />
            <div className="min-w-0">
              <h1 className="font-bold text-base sm:text-xl lg:text-2xl tracking-tight leading-tight text-white drop-shadow-md truncate">
                Daet Presbyterian Church
              </h1>
              <p className="text-[10px] sm:text-xs text-amber-300 font-serif italic flex items-center gap-1 drop-shadow-sm truncate">
                <span>Rooted in Faith • Growing in Grace</span>
              </p>
            </div>
          </div>

          {/* Carousel Progress Indicator Pills */}
          <div className="flex items-center gap-1 sm:gap-1.5 bg-indigo-950/70 backdrop-blur-md px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-white/15 shadow-md shrink-0">
            {CAROUSEL_SLIDES.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                className={`h-1.5 rounded-full transition-all duration-500 ease-out cursor-pointer ${currentSlide === idx
                  ? "w-5 sm:w-7 bg-amber-400 shadow-sm"
                  : "w-1.5 sm:w-2 bg-white/40 hover:bg-white/70"
                  }`}
                title={`Slide ${idx + 1}`}
              ></button>
            ))}
          </div>
        </div>

        {/* Bottom Inspirational Overlay & Community Stats */}
        <div className="relative z-10 space-y-4 sm:space-y-6 pt-8 sm:pt-12 md:pt-0">
          {/* Location / Current Slide Badge with smooth crossfade */}
          <div className="relative h-7 sm:h-8">
            {CAROUSEL_SLIDES.map((slide, idx) => (
              <div
                key={idx}
                className={`absolute top-0 left-0 inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-indigo-950/80 backdrop-blur-md border border-white/20 text-amber-300 text-[10px] sm:text-xs font-bold shadow-lg transition-all duration-700 ease-in-out ${currentSlide === idx
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-1.5 pointer-events-none"
                  }`}
              >
                <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
                <span className="truncate max-w-[260px] sm:max-w-none">{slide.tag}</span>
              </div>
            ))}
          </div>

          {/* Scripture Quote Container with comfortable height and crossfade transition */}
          <div className="relative min-h-[110px] sm:min-h-[125px] md:min-h-[145px] max-w-xl">
            {CAROUSEL_SLIDES.map((slide, idx) => (
              <div
                key={idx}
                className={`absolute top-0 left-0 w-full transition-all duration-700 ease-in-out space-y-1.5 ${currentSlide === idx
                  ? "opacity-100 translate-y-0 pointer-events-auto"
                  : "opacity-0 -translate-y-2 pointer-events-none"
                  }`}
              >
                <h2 className="text-sm sm:text-lg md:text-xl lg:text-2xl font-black text-white leading-snug drop-shadow-lg">
                  {slide.verse}
                </h2>
                <p className="text-[11px] sm:text-xs text-indigo-200/90 leading-relaxed drop-shadow line-clamp-3 sm:line-clamp-none">
                  {slide.citation}
                </p>
              </div>
            ))}
          </div>

          {/* Dynamic Ministries Bar fetched from Database */}
          <div className="pt-1 sm:pt-2 space-y-1.5 animate-fade-slide-up anim-delay-300">
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-300/90">
                {ministries.length > 0 ? `${ministries.length} Ministries` : "Ministries"}
              </span>
              {loadingMinistries && (
                <span className="text-[9px] text-white/50 animate-pulse">Loading...</span>
              )}
            </div>

            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {ministries.map((m) => (
                <span
                  key={m.id || m.name}
                  className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg bg-white/15 backdrop-blur-sm text-white border border-white/10 shadow-2xs hover:bg-white/25 hover:scale-105 hover:border-amber-300/40 transition-all duration-300 cursor-default"
                >
                  {m.name}
                </span>
              ))}
            </div>
          </div>

          <p className="text-[9px] sm:text-[11px] text-white/60 pt-1.5 sm:pt-2 border-t border-white/15 animate-fade-slide-up anim-delay-400">
            © 2026 Daet Presbyterian Church (DPC) • All Rights Reserved
          </p>
        </div>
      </div>

      {/* RIGHT SIDE: Auth Form Container (Responsive for Mobile, Tablet, Desktop) */}
      <div className="w-full md:w-1/2 lg:w-5/12 min-h-0 md:min-h-screen bg-ivory-light flex flex-col justify-between p-5 sm:p-8 md:p-10 lg:p-14 overflow-y-auto">
        <div className="max-w-md w-full mx-auto my-auto space-y-5 sm:space-y-6 py-4 sm:py-0">

          {/* Initial setup is available only while there are no user accounts. */}
          {!hasUsers && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2 shadow-xs animate-fade-slide-up">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-black text-xs text-amber-900">
                  <ShieldAlert className="w-4 h-4 text-amber-600 animate-pulse" />
                  <span>Initial System Setup</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowAdminModal(true); setAdminError(null); }}
                  className="px-2.5 py-1 text-[11px] font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300 rounded-lg transition-all cursor-pointer shadow-2xs"
                >
                  Configure Admin
                </button>
              </div>
              <p className="text-[11px] text-amber-800/90 leading-relaxed">
                No user accounts were found. Creating this first account will automatically assign you the Master Administrator role.
              </p>
            </div>
          )}

          {hasUsers && !hasAdmin && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 space-y-1.5 shadow-xs animate-fade-slide-up">
              <div className="flex items-center gap-2 font-black text-xs">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Administrator recovery required</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                User accounts exist, but none has the Administrator role. Contact the system owner to restore an Administrator account securely.
              </p>
            </div>
          )}

          {/* Header */}
          <div className="flex justify-end"><ThemeSelector /></div>
          <div className="animate-fade-slide-up anim-delay-100 space-y-1">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-200/60 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full inline-block shadow-2xs">
              Portal Authentication
            </span>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-charcoal tracking-tight">
              Sign In to Your Portal
            </h2>
            <p className="text-[11px] sm:text-xs text-charcoal/60 leading-relaxed">
              Enter your credentials to access church schedules, ministry kiosks, and member directories.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl sm:rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2.5 shadow-2xs">
              <AlertCircle className="w-4 h-4 text-rose shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="p-3 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* SIGN IN FORM */}
          <form onSubmit={handleLoginSubmit} className="space-y-3.5 sm:space-y-4 text-xs">
            <div className="animate-fade-slide-up anim-delay-200">
              <label className="block font-bold text-charcoal/80 mb-1 sm:mb-1.5">Email or Username</label>
              <div className="relative group">
                <Mail className="w-4 h-4 text-charcoal/40 group-focus-within:text-indigo absolute left-3.5 top-3.5 transition-colors duration-200" />
                <input
                  type="text"
                  required
                  placeholder="e.g. admin or admin@church.org"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  className="w-full bg-white pl-10 pr-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-gray-200 hover:border-indigo-300 focus:outline-none focus:border-indigo focus:ring-3 focus:ring-indigo/15 font-medium text-charcoal text-sm sm:text-xs shadow-2xs transition-all duration-300"
                />
              </div>
            </div>

            <div className="animate-fade-slide-up anim-delay-250">
              <label className="block font-bold text-charcoal/80 mb-1 sm:mb-1.5">Password</label>
              <div className="relative group">
                <Lock className="w-4 h-4 text-charcoal/40 group-focus-within:text-indigo absolute left-3.5 top-3.5 transition-colors duration-200" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white pl-10 pr-10 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-gray-200 hover:border-indigo-300 focus:outline-none focus:border-indigo focus:ring-3 focus:ring-indigo/15 font-medium text-charcoal text-sm sm:text-xs shadow-2xs transition-all duration-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-charcoal/40 hover:text-charcoal transition-colors cursor-pointer rounded-lg hover:bg-gray-100"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="text-[10px] text-charcoal/50 mt-1 sm:mt-1.5 flex justify-between">
                <span>Default demo password: <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-indigo font-bold">password123</code></span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo hover:bg-indigo-700 text-white font-bold py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-xs shadow-md hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 mt-2 shimmer-button animate-fade-slide-up anim-delay-300 cursor-pointer"
            >
              <span>{submitting ? "Authenticating..." : "Sign In to DPC Portal"}</span>
              <ArrowRight className="w-4 h-4 text-amber-300 transition-transform group-hover:translate-x-1" />
            </button>
          </form>

          {/* Divider & 1-Click Demo Login (Responsive grid: 1-col on mobile phones, 2-col on tablets and desktops) */}
          {hasUsers && demoUsers.length > 0 && (
            <div className="animate-fade-slide-up anim-delay-400 space-y-2.5 sm:space-y-3">
              <div className="flex items-center gap-3 pt-1 sm:pt-2">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-[10px] font-bold text-charcoal/40 uppercase tracking-wider">
                  Or 1-Click Demo Login
                </span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>

              {/* 1-Click Role Login Quick Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                {demoUsers.map((u, idx) => {
                  const roleColors: Record<string, string> = {
                    Admin: "border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-200 hover:border-cyan-300",
                    "IT Admin": "border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-200 hover:border-cyan-300",
                    Pastor: "border-amber-300 bg-amber-50/80 hover:bg-amber-100/90 text-amber-950 hover:border-amber-400",
                    Coordinator: "border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100/90 text-indigo-950 hover:border-indigo-300",
                    Leader: "border-sky-300 bg-sky-50/80 hover:bg-sky-100/90 text-sky-950 hover:border-sky-400",
                    Volunteer: "border-sage-300 bg-sage-50/80 hover:bg-sage-100/90 text-sage-950 hover:border-sage-400",
                    Member: "border-rose-200 bg-rose-50/80 hover:bg-rose-100/90 text-rose-950 hover:border-rose-300",
                  };

                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleDemoLogin(u.id)}
                      disabled={submitting}
                      className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-md active:scale-95 shadow-2xs cursor-pointer ${roleColors[u.role_name] || "border-gray-200 bg-white"
                        }`}
                      style={{ animationDelay: `${400 + idx * 50}ms` }}
                    >
                      <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                        <span className="font-bold text-xs">{u.name}</span>
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-white/90 shadow-2xs">
                          {u.role_name}
                        </span>
                      </div>
                      <p className="text-[10px] opacity-75 truncate">{u.username ? `@${u.username}` : u.email}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer Support Info */}
        <div className="pt-6 border-t border-gray-200/80 text-center max-w-md w-full mx-auto">
          <p className="text-[11px] text-charcoal/50">
            Daet Presbyterian Church • <span className="font-semibold text-indigo">Church Management System</span>
          </p>
        </div>
      </div>

      {/* MASTER ADMINISTRATOR SETUP MODAL */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-indigo-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-amber-300/80 p-6 sm:p-8 space-y-5 animate-scale-up my-auto">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowAdminModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold shadow-2xs">
                <ShieldAlert className="w-4 h-4 text-amber-600 animate-pulse" />
                <span>Initial System Setup Required</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-charcoal tracking-tight">
                Create the Initial Administrator
              </h3>
              <p className="text-xs text-charcoal/70 leading-relaxed">
                No user accounts exist yet. Create the initial Master Administrator account for <strong>Daet Presbyterian Church</strong> to manage ministries, rosters, schedules, and portal settings.
              </p>
            </div>

            {/* Modal Error/Success Alerts */}
            {adminError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2.5 shadow-2xs">
                <AlertCircle className="w-4 h-4 text-rose shrink-0" />
                <span>{adminError}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Admin Registration Form in Modal */}
            <form onSubmit={handleAdminSetupSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-charcoal mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pastor / Elder Admin"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="block font-bold text-charcoal mb-1">Username (for easy sign-in)</label>
                <div className="relative">
                  <AtSign className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. admin"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-medium focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-charcoal mb-1">Admin Email Address</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. admin@church.org"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-medium focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-charcoal mb-1">Master Password</label>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-3" />
                    <input
                      type={showAdminPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-gray-200 rounded-xl pl-9 pr-9 py-2.5 text-xs font-medium focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer rounded-lg hover:bg-gray-200"
                      title={showAdminPassword ? "Hide password" : "Show password"}
                    >
                      {showAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-charcoal mb-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-3" />
                    <input
                      type={showAdminConfirmPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={adminConfirmPassword}
                      onChange={(e) => setAdminConfirmPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-gray-200 rounded-xl pl-9 pr-9 py-2.5 text-xs font-medium focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminConfirmPassword(!showAdminConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer rounded-lg hover:bg-gray-200"
                      title={showAdminConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showAdminConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{submitting ? "Creating Master Admin..." : "Create Master Administrator Account"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="text-[11px] text-charcoal/60 hover:text-charcoal hover:underline cursor-pointer"
                >
                  Skip for now & return to login screen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
