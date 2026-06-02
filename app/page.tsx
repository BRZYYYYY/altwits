"use client";

import { useState } from 'react';
import { 
  Sun, Moon, LogOut, ShieldAlert, ChevronRight, GraduationCap, 
  Award, Star, CheckCircle2, XCircle, HelpCircle, Info, ShieldCheck,
  Eye, EyeOff
} from 'lucide-react';

export default function GradePortal() {
    const [creds, setCreds] = useState({ id: "", pw: "" });
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const [showGrades, setShowGrades] = useState(true);
    const [modal, setModal] = useState<{ show: boolean, msg: string }>({ show: false, msg: "" });
    const [infoModal, setInfoModal] = useState<{ show: boolean, type: 'deans' | 'parangal' | null }>({ show: false, type: null });
    
    const [authLoading, setAuthLoading] = useState(false);
    const [gradesLoading, setGradesLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [grades, setGrades] = useState<any[]>([]);
    const [viewing, setViewing] = useState<any>(null);

    const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    const showError = (msg: string) => setModal({ show: true, msg });

    const calculateAwardGwa = (enrollment: any) => {
        if (!enrollment) return 0;
        const courses = enrollment.enrolledCourseGradeDetails || enrollment.studentGradeHistoryData || [];
        let totalWeightedGrade = 0;
        let totalIncludedUnits = 0;

        courses.forEach((course: any) => {
            const title = course.courseTitle?.toUpperCase() || "";
            const isNSTP = title.includes("NATIONAL SERVICE TRAINING PROGRAM");
            const grade = parseFloat(course.gradeDetailFinal?.grade);
            const units = parseFloat(course.units);

            if (!isNSTP && !isNaN(grade) && !isNaN(units)) {
                totalWeightedGrade += (grade * units);
                totalIncludedUnits += units;
            }
        });
        return totalIncludedUnits > 0 ? (totalWeightedGrade / totalIncludedUnits) : 0;
    };

    const startAuth = async () => {
        setModal({ show: false, msg: "" });
        setAuthLoading(true);
        try {
            const loginRes = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId: creds.id, password: creds.pw })
            });
            const auth = await loginRes.json();
            if (auth?.token) {
                setModal({ show: false, msg: "" }); 
                setData(auth);
                await fetchGrades(auth.token);
            } else {
                showError("Invalid Student ID or Password.");
            }
        } catch (e) {
            showError("Authentication failed. Please check connection.");
        } finally {
            setAuthLoading(false);
        }
    };

    const fetchGrades = async (token: string) => {
        setGradesLoading(true);
        try {
            const gradeRes = await fetch('/api/grade', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const gradeData = await gradeRes.json();
            const list = gradeData?.items?.studentEnrollments || [];
            const sorted = [...list].sort((a, b) => (b.idStudentEnrollment || 0) - (a.idStudentEnrollment || 0));
            setGrades(sorted);
            if (sorted.length > 0) setViewing(sorted[0]);
        } catch (e) {
            showError("Failed to fetch records.");
        } finally {
            setGradesLoading(false);
        }
    };

    const DEANS_MIN = 4.25;
    const PARANGAL_MIN = 4.4;

    const getAwardStatus = () => {
        if (!viewing || grades.length === 0) return { deans: false, parangal: false, basis: [] };
        
        const currentYearStr = viewing.academicYear;
        const currentTerm = viewing.term;
        const isFirstYear = viewing.yearLevel === "First Year";
        let basis: any[] = [];

        const yearParts = currentYearStr.split(' - ');
        const startYear = parseInt(yearParts[0]);
        const endYear = parseInt(yearParts[1]);

        if (isFirstYear && currentTerm === "First Semester") {
            basis = [{ year: currentYearStr, term: "First Semester", gwa: calculateAwardGwa(viewing) }];
        } else if (currentTerm === "First Semester") {
            const prevYearStr = `${startYear - 1} - ${startYear}`;
            const prev2ndSem = grades.find(g => g.academicYear === prevYearStr && g.term === "Second Semester");
            basis = [
                { year: currentYearStr, term: "First Semester", gwa: calculateAwardGwa(viewing) },
                ...(prev2ndSem ? [{ year: prevYearStr, term: "Second Semester", gwa: calculateAwardGwa(prev2ndSem) }] : [])
            ];
        } else {
            const nextYearStr = `${endYear} - ${endYear + 1}`;
            const next1stSem = grades.find(g => g.academicYear === nextYearStr && g.term === "First Semester");
            basis = [
                { year: currentYearStr, term: "Second Semester", gwa: calculateAwardGwa(viewing) },
                ...(next1stSem ? [{ year: nextYearStr, term: "First Semester", gwa: calculateAwardGwa(next1stSem) }] : [])
            ];
        }

        const hasFullCycle = basis.length === 2 || (isFirstYear && basis.length === 1);
        const allMeetDeans = hasFullCycle && basis.every(b => b.gwa >= DEANS_MIN);
        const allMeetParangal = hasFullCycle && basis.every(b => b.gwa >= PARANGAL_MIN);

        return { deans: allMeetDeans && !allMeetParangal, parangal: allMeetParangal, basis };
    };

    const awardInfo = getAwardStatus();
    const themeClass = theme === 'dark' ? "bg-[#1a1616] text-gray-300" : "bg-gray-50 text-gray-800";
    const cardClass = theme === 'dark' ? "bg-[#241f1f] border-[#3d3333]" : "bg-white border-gray-200 shadow-sm";

    const getGradeColor = (gradeStr: string, isMidterm: boolean) => {
        const g = parseFloat(gradeStr);
        if (isNaN(g)) return "";
        if (g === 5.0) return "text-cyan-400 font-black drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]";
        if (g < 3.0) return "text-red-500 font-bold";
        return isMidterm ? "text-[#facc15] font-bold" : "text-green-400 font-bold";
    };

    if (!data) {
        return (
            <div className={`flex items-center justify-center min-h-screen p-4 transition-colors duration-500 ${themeClass}`}>
                {modal.show && <ErrorModal msg={modal.msg} onClose={() => setModal({ show: false, msg: "" })} theme={theme} />}
                <div className={`w-full max-w-sm p-8 border rounded-3xl shadow-2xl ${cardClass}`}>
                    <div className="flex flex-col items-center mb-8 gap-3 text-center">
                        <div className="w-16 h-16 bg-[#800000] rounded-2xl flex items-center justify-center shadow-lg"><GraduationCap size={32} className="text-[#facc15]" /></div>
                        <h1 className="text-2xl font-black tracking-tighter italic uppercase text-white">Wildcat Tunnel</h1>
                    </div>
                    <div className="space-y-4">
                        <input className={`w-full border p-4 rounded-2xl outline-none focus:ring-2 focus:ring-[#800000] transition-all ${theme === 'dark' ? 'bg-[#1a1616] border-[#3d3333] text-white' : 'bg-white border-gray-300'}`} placeholder="Student ID" value={creds.id} onChange={e => setCreds({...creds, id: e.target.value})} />
                        <input className={`w-full border p-4 rounded-2xl outline-none focus:ring-2 focus:ring-[#800000] transition-all ${theme === 'dark' ? 'bg-[#1a1616] border-[#3d3333] text-white' : 'bg-white border-gray-300'}`} placeholder="Password" type="password" value={creds.pw} onChange={e => setCreds({...creds, pw: e.target.value})} />
                        <button onClick={startAuth} disabled={authLoading} className="w-full bg-[#800000] hover:bg-[#990000] py-4 rounded-2xl text-white font-black transition-all disabled:opacity-50 uppercase text-xs tracking-widest">{authLoading ? "SIGNING IN..." : "SIGN IN"}</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen p-4 md:p-8 transition-colors duration-500 ${themeClass}`}>
            <style jsx global>{`
                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-track { background: ${theme === 'dark' ? '#1a1616' : '#f3f4f6'}; }
                ::-webkit-scrollbar-thumb { background: #800000; border-radius: 10px; }
                ::-webkit-scrollbar-thumb:hover { background: #facc15; }
            `}</style>

            {modal.show && <ErrorModal msg={modal.msg} onClose={() => setModal({ show: false, msg: "" })} theme={theme} />}
            {infoModal.show && (
                <InfoWindow 
                    type={infoModal.type} 
                    onClose={() => setInfoModal({ show: false, type: null })} 
                    theme={theme}
                    thresholds={{ deans: DEANS_MIN, parangal: PARANGAL_MIN }}
                    basis={awardInfo.basis}
                    showGrades={showGrades}
                />
            )}

            <div className="max-w-6xl mx-auto">
                <header className={`flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 p-6 rounded-3xl border shadow-lg ${cardClass}`}>
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-[#800000] border-2 border-[#facc15]/30 rounded-2xl flex items-center justify-center text-[#facc15] font-black text-2xl shadow-xl">{data.userInfo?.fullName?.charAt(0)}</div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight text-white uppercase leading-none mb-1">{data.userInfo?.fullName}</h2>
                            <div className="flex gap-3 text-[10px] font-mono font-bold"><span>ID: {data.userInfo?.studentId}</span><span className="text-[#facc15]">● ONLINE</span></div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={toggleTheme} className="p-3 rounded-xl border border-[#3d3333] hover:bg-white/5 transition-all text-[#facc15]">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
                        <button onClick={() => window.location.reload()} className="flex items-center gap-2 px-5 py-3 text-xs font-black text-red-400 border border-red-900/20 rounded-xl hover:bg-red-500 hover:text-white transition-all"><LogOut size={14} /> LOGOUT</button>
                    </div>
                </header>

                <div className={`w-full mb-8 p-5 rounded-3xl border flex items-start gap-4 shadow-md ${theme === 'dark' ? 'bg-[#facc15]/5 border-[#facc15]/10' : 'bg-yellow-50 border-yellow-100'}`}>
                    <ShieldCheck className="text-[#facc15] shrink-0" size={22} />
                    <div className="space-y-1 text-left">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.1em] text-[#facc15]">Security & Privacy Policy</h4>
                        <p className={`text-xs font-medium leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-gray-700'}`}>This portal is an alternative frontend for grade viewing. We do not store any academic data. All information is fetched in real-time from official servers and discarded upon logout.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <aside className="space-y-3">
                        <h3 className="text-[10px] font-black opacity-30 uppercase tracking-widest mb-4 text-left">Academic History</h3>
                        {gradesLoading ? [1, 2, 3, 4].map(i => <div key={i} className={`h-16 rounded-2xl animate-pulse ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-200'}`} />) : 
                            grades?.map((en, i) => (
                                <div key={i} onClick={() => setViewing(en)} className={`p-5 rounded-2xl cursor-pointer border flex justify-between items-center transition-all duration-300 ${viewing === en ? 'bg-[#800000] border-[#facc15]/50 text-white shadow-xl' : cardClass + ' hover:border-[#800000]/50'}`}>
                                    <div>
                                        <div className={`font-black text-xs uppercase ${viewing === en ? 'text-[#facc15]' : ''}`}>{en.academicYear}</div>
                                        <div className="text-[9px] opacity-60 uppercase font-bold mt-1 tracking-tight">{en.term}</div>
                                    </div>
                                    <ChevronRight size={14} className={viewing === en ? 'text-[#facc15]' : 'opacity-20'} />
                                </div>
                            ))
                        }
                    </aside>

                    <main className="lg:col-span-3">
                        {gradesLoading ? (
                            <div className={`h-96 border rounded-3xl flex items-center justify-center ${cardClass}`}><div className="animate-spin w-10 h-10 border-4 border-[#facc15] border-t-transparent rounded-full" /></div>
                        ) : viewing ? (
                            <div className="space-y-5">
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex flex-wrap gap-3">
                                        {awardInfo.deans && (
                                            <button onClick={() => setInfoModal({ show: true, type: 'deans' })} className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 hover:bg-amber-500/20 transition-all font-black text-[10px] uppercase shadow-sm group">
                                                <Award size={16} /> Dean's Lister <HelpCircle size={12} className="opacity-30 group-hover:opacity-100" />
                                            </button>
                                        )}
                                        {awardInfo.parangal && (
                                            <button onClick={() => setInfoModal({ show: true, type: 'parangal' })} className="flex items-center gap-2 px-4 py-2.5 bg-[#800000]/10 border border-[#800000]/20 rounded-xl text-[#ff8080] hover:bg-[#800000]/20 transition-all font-black text-[10px] uppercase shadow-sm group">
                                                <Star size={16} /> Parangal Awardee <HelpCircle size={12} className="opacity-30 group-hover:opacity-100" />
                                            </button>
                                        )}
                                    </div>
                                    <button onClick={() => setShowGrades(!showGrades)} className={`flex items-center gap-3 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${showGrades ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-[#facc15]/10 border-[#facc15]/30 text-[#facc15] hover:bg-[#facc15]/20'}`}>
                                        {showGrades ? <EyeOff size={16} /> : <Eye size={16} />} {showGrades ? "Hide Grades" : "Show Grades"}
                                    </button>
                                </div>

                                <div className={`border rounded-3xl overflow-hidden shadow-2xl ${cardClass}`}>
                                    <div className={`p-8 border-b flex flex-col md:flex-row justify-between items-center gap-6 border-inherit ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                                        <div className="text-left">
                                            <h3 className="text-base font-black uppercase tracking-wider text-white leading-none mb-2">{viewing.academicYear}</h3>
                                            <p className="text-xs text-[#facc15] font-black uppercase tracking-widest">{viewing.term}</p>
                                        </div>
                                        <div className="flex gap-4 text-xs font-mono">
                                            <div className={`px-5 py-2.5 rounded-2xl border border-[#facc15]/20 text-[#facc15] bg-[#facc15]/5 font-black transition-all duration-500 ${!showGrades ? 'blur-[3px] opacity-40 select-none' : ''}`}>GWA: {viewing.gwa}</div>
                                            <div className={`px-5 py-2.5 rounded-2xl border border-[#800000]/30 text-[#ff8080] bg-[#800000]/5 font-black`}>Units: {viewing.totalUnits}</div>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className={`text-[10px] uppercase font-black tracking-widest ${theme === 'dark' ? 'bg-[#1a1616]' : 'bg-gray-100'} border-b border-inherit`}>
                                                <tr><th className="px-8 py-5 text-[#facc15]">Code</th><th className="px-8 py-5 text-white">Subject</th><th className="px-8 py-5 text-center">Units</th><th className="px-8 py-5 text-center text-[#facc15]">Midterm</th><th className="px-8 py-5 text-center text-[#ff8080]">Final</th><th className="px-8 py-5 text-center text-white">Status</th></tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#3d3333]">
                                                {(viewing.enrolledCourseGradeDetails || viewing.studentGradeHistoryData || []).map((c: any, i: number) => {
                                                    const midterm = c.gradeDetails?.find((g: any) => g.periodName === "Midterm")?.grade || "-";
                                                    const finalGrade = c.gradeDetailFinal?.grade;
                                                    const isPassed = c.gradeDetailFinal?.remarks?.toUpperCase() === "PASSED" || c.remarks?.toUpperCase() === "PASSED";
                                                    const isFailed = c.gradeDetailFinal?.remarks?.toUpperCase() === "FAILED" || c.remarks?.toUpperCase() === "FAILED";
                                                    return (
                                                        <tr key={i} className="hover:bg-white/5 transition-all">
                                                            <td className="px-8 py-5 font-mono text-[#facc15] text-[11px] font-black">{c.courseCode}</td>
                                                            <td className="px-8 py-5 text-xs font-bold text-gray-300">{c.courseTitle}</td>
                                                            <td className="px-8 py-5 text-center text-[11px] font-bold opacity-30">{c.units}</td>
                                                            <td className={`px-8 py-5 text-center font-mono text-xs transition-all duration-500 ${!showGrades && midterm !== "-" ? 'blur-[3px] opacity-30 select-none' : getGradeColor(midterm, true)}`}>{midterm}</td>
                                                            <td className={`px-8 py-5 text-center font-black text-xs transition-all duration-500 ${!showGrades ? 'blur-[3px] opacity-30 select-none' : getGradeColor(finalGrade, false)}`}>{finalGrade || "-"}</td>
                                                            <td className="px-8 py-5 text-center">
                                                                <div className={`inline-flex items-center gap-2 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-tighter ${isPassed ? 'text-green-400 bg-green-950/20' : isFailed ? 'text-red-400 bg-red-950/20' : 'text-gray-400 bg-gray-500/10'}`}>
                                                                    {isPassed && <CheckCircle2 size={12} />} {isFailed && <XCircle size={12} />} {(isPassed || isFailed) ? (isPassed ? "PASSED" : "FAILED") : "-"}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </main>
                </div>
            </div>
        </div>
    );
}

function InfoWindow({ type, onClose, theme, thresholds, basis, showGrades }: any) {
    const isDeans = type === 'deans';
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className={`w-full max-w-sm p-8 rounded-[2.5rem] border shadow-2xl ${theme === 'dark' ? 'bg-[#241f1f] border-[#3d3333]' : 'bg-white border-gray-200'}`}>
                <div className={`flex items-center gap-4 mb-6 ${isDeans ? 'text-amber-500' : 'text-[#ff8080]'}`}>
                    {isDeans ? <Award size={32} /> : <Star size={32} />}
                    <h2 className="font-black uppercase text-white text-xl leading-none">{isDeans ? "Dean's List" : "Parangal Award"}</h2>
                </div>
                <div className="space-y-4 mb-8">
                    <p className="text-[10px] uppercase font-black opacity-30 tracking-widest">Calculation Basis (NSTP Excluded):</p>
                    {basis?.map((b: any, idx: number) => (
                        <div key={idx} className={`p-4 rounded-2xl border flex justify-between items-center ${isDeans ? 'bg-amber-500/5 border-amber-500/20' : 'bg-[#800000]/5 border-[#800000]/20'}`}>
                            <div className="flex flex-col text-left"><span className="text-[10px] font-black text-white">{b.year}</span><span className={`text-[9px] opacity-50 uppercase font-black mt-0.5 ${isDeans ? 'text-amber-500' : 'text-[#facc15]'}`}>{b.term}</span></div>
                            <span className={`font-black text-xl ${!showGrades ? 'blur-[3px] opacity-40' : (isDeans ? 'text-amber-500' : 'text-[#facc15]')}`}>{typeof b.gwa === 'number' ? b.gwa.toFixed(3) : b.gwa}</span>
                        </div>
                    ))}
                    <p className="text-[11px] opacity-40 font-bold leading-relaxed pt-4 border-t border-inherit text-center">
                        {isDeans ? `Dean's List: Both semesters must be between ${thresholds.deans} and 4.399.` : `Parangal Award: Both semesters must be ${thresholds.parangal} or higher.`}
                    </p>
                </div>
                <button onClick={onClose} className="w-full py-4 bg-[#800000] text-white font-black rounded-2xl uppercase text-xs tracking-widest shadow-lg hover:bg-[#990000] transition-all">Close Analysis</button>
            </div>
        </div>
    );
}

function ErrorModal({ msg, onClose, theme }: any) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className={`w-full max-md p-8 rounded-3xl border shadow-2xl ${theme === 'dark' ? 'bg-[#241f1f] border-red-900/20' : 'bg-white border-red-100'}`}>
                <div className="flex items-center gap-4 text-red-500 mb-6 font-black tracking-tight uppercase"><ShieldAlert size={28} /> System Warning</div>
                <p className="text-sm opacity-50 mb-8 font-bold leading-relaxed">{msg}</p>
                <button onClick={onClose} className="w-full py-4 bg-red-600 text-white font-black rounded-2xl uppercase text-xs tracking-widest">Okay</button>
            </div>
        </div>
    );
}