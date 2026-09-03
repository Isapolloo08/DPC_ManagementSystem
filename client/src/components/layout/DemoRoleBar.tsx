import React from "react";
import { useAuth } from "../../context/AuthContext";
import { ShieldCheck, UserCheck, HeartHandshake, User, Sparkles, BookOpen } from "lucide-react";

export const DemoRoleBar: React.FC = () => {
  const { user, demoUsers, switchDemoUser } = useAuth();

  const getRoleIcon = (roleName: string) => {
    switch (roleName) {
      case "Admin":
        return <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />;
      case "Coordinator":
        return <UserCheck className="w-3.5 h-3.5 text-emerald-300" />;
      case "Leader":
        return <BookOpen className="w-3.5 h-3.5 text-sky-300" />;
      case "Volunteer":
        return <HeartHandshake className="w-3.5 h-3.5 text-rose-300" />;
      default:
        return <User className="w-3.5 h-3.5 text-indigo-200" />;
    }
  };

  return (
    <div className="bg-indigo-900 text-white px-4 py-1.5 text-xs flex flex-wrap items-center justify-between border-b border-indigo-800 gap-2">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 font-semibold text-amber-400">
          <Sparkles className="w-3.5 h-3.5" />
          Interactive Role Switcher:
        </span>
        <span className="text-indigo-200 hidden sm:inline">
          Test the system across all 5 RBAC tiers with realistic pre-seeded data:
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {demoUsers.map((du) => {
          const isActive = user?.id === du.id;
          return (
            <button
              key={du.id}
              onClick={() => switchDemoUser(du.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? "bg-amber text-charcoal font-bold shadow-sm ring-2 ring-white/50"
                  : "bg-indigo-800/80 hover:bg-indigo-700 text-indigo-100 hover:text-white"
              }`}
            >
              {getRoleIcon(du.role_name)}
              <span>{du.role_name}</span>
              <span className="opacity-75 text-[10px] hidden md:inline">({du.name.split(" ")[0]})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
