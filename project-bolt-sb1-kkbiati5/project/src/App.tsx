import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import History from "./pages/History";
import Settings from "./pages/Settings";
import IntradayScreener from "./pages/IntradayScreener";
import ChochDetector from "./pages/ChochDetector";
import Scanner from "./pages/Scanner";
import PatternDetail from "./pages/PatternDetail";
import Backtesting from "./pages/Backtesting";
import IpoAnalysis from "./pages/IpoAnalysis";
import VolumeFinder from "./pages/VolumeFinder";
import StocksToTrade from "./pages/StocksToTrade";
import Sectors from "./pages/Sectors";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/screener" element={<IntradayScreener />} />
            <Route path="/choch" element={<ChochDetector />} />
            <Route path="/scanner" element={<Scanner />} />
            <Route path="/scanner/:id" element={<PatternDetail />} />
            <Route path="/backtest" element={<Backtesting />} />
            <Route path="/ipo" element={<IpoAnalysis />} />
            <Route path="/volume-finder" element={<VolumeFinder />} />
            <Route path="/trade-today" element={<StocksToTrade />} />
            <Route path="/sectors" element={<Sectors />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
