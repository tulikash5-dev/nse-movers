import { NavLink } from "react-router-dom";
import { TrendingUp, Clock, Settings, BarChart2, Zap, Activity, Radar, FlaskConical, Sparkles, Volume2, Target, Layers } from "lucide-react";

export default function Navbar() {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <BarChart2 size={18} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-white font-bold text-lg tracking-tight">NSE Movers</span>
            <span className="hidden sm:block text-slate-500 text-xs ml-1 font-medium">Indian Stock Tracker</span>
          </div>

          <nav className="flex items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`
              }
            >
              <TrendingUp size={15} />
              <span className="hidden sm:inline">Today</span>
            </NavLink>

            <NavLink
              to="/screener"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-amber-700 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`
              }
            >
              <Zap size={15} />
              <span className="hidden sm:inline">Screener</span>
            </NavLink>

            <NavLink
              to="/choch"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-cyan-700 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`
              }
            >
              <Activity size={15} />
              <span className="hidden sm:inline">CHOCH</span>
            </NavLink>

            <NavLink
              to="/scanner"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-violet-700 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`
              }
            >
              <Radar size={15} />
              <span className="hidden sm:inline">Scanner</span>
            </NavLink>

            <NavLink
              to="/volume-finder"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-700 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`
              }
            >
              <Volume2 size={15} />
              <span className="hidden sm:inline">Volume</span>
            </NavLink>

            <NavLink
              to="/sectors"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-orange-700 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`
              }
            >
              <Layers size={15} />
              <span className="hidden sm:inline">Sectors</span>
            </NavLink>

            <NavLink
              to="/trade-today"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-700 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`
              }
            >
              <Target size={15} />
              <span className="hidden sm:inline">Trade Today</span>
            </NavLink>

            <NavLink
              to="/ipo"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-amber-700 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`
              }
            >
              <Sparkles size={15} />
              <span className="hidden sm:inline">IPO</span>
            </NavLink>

            <NavLink
              to="/backtest"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-teal-700 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`
              }
            >
              <FlaskConical size={15} />
              <span className="hidden sm:inline">Backtest</span>
            </NavLink>

            <NavLink
              to="/history"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`
              }
            >
              <Clock size={15} />
              <span className="hidden sm:inline">History</span>
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`
              }
            >
              <Settings size={15} />
              <span className="hidden sm:inline">Settings</span>
            </NavLink>
          </nav>
        </div>
      </div>
    </header>
  );
}
