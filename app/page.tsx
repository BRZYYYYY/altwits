"use client";

import { useState, useEffect } from 'react';
import { 
  LogOut, ShieldAlert, Award, Star, CheckCircle2, XCircle, ShieldCheck,
  Eye, EyeOff, Instagram, Sun, Moon
} from 'lucide-react';

export default function GradePortal() {
    const [creds, setCreds] = useState({ id: "", pw: "" });
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [showGrades, setShowGrades] = useState(true);
    const [modal, setModal] = useState<{ show: boolean, msg: string }>({ show: false, msg: "" });
    const [infoModal, setInfoModal] = useState<{ show: boolean, type: 'deans' | 'parangal' | null }>({ show: false, type: null });
    
    const [authLoading, setAuthLoading] = useState(false);
    const [gradesLoading, setGradesLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [grades, setGrades] = useState<any[]>([]);
    const [viewing, setViewing] = useState<any>(null);

    useEffect(() => {
        const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
        const initial = saved || 'light';
        setTheme(initial);
        if (initial === 'dark') {
            document.documentElement.classList.add('dark');
        }
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

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

    if (!data) {
        return (
            <div className={`flex items-center justify-center min-h-screen p-4 transition-colors ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
                {modal.show && <ErrorModal msg={modal.msg} onClose={() => setModal({ show: false, msg: "" })} theme={theme} />}
                <div className={`w-full max-w-sm p-8 border rounded-lg transition-colors ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-3xl font-bold text-center flex-1">ALT WITS</h1>
                        <button onClick={toggleTheme} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}>
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                    </div>
                    <div className="space-y-4">
                        <input 
                            className={`w-full border p-4 rounded-lg outline-none transition-all ${theme === 'dark' ? 'bg-gray-700 border-gray-600 focus:border-white text-white placeholder-gray-400' : 'bg-white border-gray-300 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 text-gray-900 placeholder-gray-500'}`}
                            placeholder="Student ID" 
                            value={creds.id} 
                            onChange={e => setCreds({...creds, id: e.target.value})} 
                        />
                        <input 
                            className={`w-full border p-4 rounded-lg outline-none transition-all ${theme === 'dark' ? 'bg-gray-700 border-gray-600 focus:border-white text-white placeholder-gray-400' : 'bg-white border-gray-300 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 text-gray-900 placeholder-gray-500'}`}
                            placeholder="Password" 
                            type="password" 
                            value={creds.pw} 
                            onChange={e => setCreds({...creds, pw: e.target.value})} 
                        />
                        <button 
                            onClick={startAuth} 
                            disabled={authLoading} 
                            className={`w-full py-4 rounded-lg font-bold transition-all disabled:opacity-50 uppercase text-sm tracking-wider ${theme === 'dark' ? 'bg-white hover:bg-gray-100 text-gray-900' : 'bg-gray-900 hover:bg-black text-white'}`}
                        >
                            {authLoading ? "SIGNING IN..." : "SIGN IN"}
                        </button>
                    </div>
                    <div className={`mt-8 pt-6 border-t transition-colors ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} text-center space-y-2`}>
                        <p className={`text-xs flex items-center justify-center gap-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            UPD by: <Instagram size={12} />{" "}
                            <a href="https://www.instagram.com/brzy.y4/" target="_blank" rel="noopener noreferrer" className={`hover:underline font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>@brzy.y4</a>
                        </p>
                        <p className={`text-[10px] ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>INSPO: @mrxception</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen p-4 md:p-8 transition-colors ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
            {modal.show && <ErrorModal msg={modal.msg} onClose={() => setModal({ show: false, msg: "" })} theme={theme} />}
            {infoModal.show && (
                <InfoWindow 
                    type={infoModal.type} 
                    onClose={() => setInfoModal({ show: false, type: null })} 
                    thresholds={{ deans: DEANS_MIN, parangal: PARANGAL_MIN }}
                    basis={awardInfo.basis}
                    showGrades={showGrades}
                    theme={theme}
                />
            )}

            <div className="max-w-6xl mx-auto">
                <header className={`flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 p-6 border rounded-lg transition-colors ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center gap-5">
                        <div>
                            <h2 className="text-xl font-bold">{data.userInfo?.fullName}</h2>
                            <div className={`flex gap-3 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}><span>ID: {data.userInfo?.studentId}</span></div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={toggleTheme} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}>
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <button onClick={() => window.location.reload()} className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border rounded-lg transition-all ${theme === 'dark' ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 text-white' : 'text-gray-700 border-gray-300 hover:bg-gray-100'}`}><LogOut size={14} /></button>
                    </div>
                </header>

                <div className={`w-full mb-8 p-5 border rounded-lg transition-colors ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-start gap-4">
                        <ShieldCheck className={`shrink-0 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} size={20} />
                        <div className="space-y-1 text-left">
                            <h4 className={`text-xs font-bold uppercase tracking-wide ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Security & Privacy Policy</h4>
                            <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>This portal is an alternative frontend for grade viewing. We do not store any academic data. All information is fetched in real-time from official servers and discarded upon logout.</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <aside className="space-y-3">
                        <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 text-left ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Academic History</h3>
                        {gradesLoading ? [1, 2, 3, 4].map(i => <div key={i} className={`h-16 rounded-lg animate-pulse ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`} />) : 
                            grades?.map((en, i) => (
                                <div key={i} onClick={() => setViewing(en)} className={`p-5 rounded-lg cursor-pointer border transition-all ${viewing === en ? (theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-900 border-gray-900 text-white') : (theme === 'dark' ? 'border-gray-700 hover:border-gray-600 bg-gray-800' : 'border-gray-200 hover:border-gray-400 bg-white')}`}>
                                    <div>
                                        <div className={`font-bold text-xs uppercase ${viewing === en ? 'text-white' : (theme === 'dark' ? 'text-white' : 'text-gray-900')}`}>{en.academicYear}</div>
                                        <div className={`text-xs uppercase font-semibold mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{en.term}</div>
                                    </div>
                                </div>
                            ))
                        }
                    </aside>

                    <main className="lg:col-span-3">
                        {gradesLoading ? (
                            <div className={`h-96 border rounded-lg flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}><div className={`animate-spin w-10 h-10 border-4 rounded-full ${theme === 'dark' ? 'border-gray-600 border-t-white' : 'border-gray-300 border-t-gray-900'}`} /></div>
                        ) : viewing ? (
                            <div className="space-y-6">
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex flex-wrap gap-3">
                                        {awardInfo.deans && (
                                            <button onClick={() => setInfoModal({ show: true, type: 'deans' })} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs uppercase transition-all border ${theme === 'dark' ? 'bg-gray-800 border-gray-600 text-white hover:bg-gray-700' : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
                                                <Award size={16} /> Dean's Lister
                                            </button>
                                        )}
                                        {awardInfo.parangal && (
                                            <button onClick={() => setInfoModal({ show: true, type: 'parangal' })} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs uppercase transition-all border ${theme === 'dark' ? 'bg-gray-800 border-gray-600 text-white hover:bg-gray-700' : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
                                                <Star size={16} /> Parangal Awardee
                                            </button>
                                        )}
                                    </div>
                                    <button onClick={() => setShowGrades(!showGrades)} className={`flex items-center gap-3 px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${theme === 'dark' ? 'bg-gray-800 border-gray-600 text-white hover:bg-gray-700' : 'border-gray-300 text-gray-900 hover:bg-gray-100'}`}>
                                        {showGrades ? <EyeOff size={16} /> : <Eye size={16} />} {showGrades ? "Hide Grades" : "Show Grades"}
                                    </button>
                                </div>

                                <div className={`border rounded-lg overflow-hidden transition-colors ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                    <div className={`p-6 border-b flex flex-col md:flex-row justify-between items-center gap-6 transition-colors ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                                        <div className="text-left">
                                            <h3 className={`text-base font-bold uppercase tracking-wide ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{viewing.academicYear}</h3>
                                            <p className={`text-xs font-semibold uppercase mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{viewing.term}</p>
                                        </div>
                                        <div className="flex gap-4 text-xs font-mono font-bold">
                                            <div className={`px-4 py-2 rounded-lg border transition-colors ${theme === 'dark' ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>GWA: {viewing.gwa}</div>
                                            <div className={`px-4 py-2 rounded-lg border transition-colors ${theme === 'dark' ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>Units: {viewing.totalUnits}</div>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className={`text-xs font-bold uppercase tracking-wide border-b transition-colors ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                                                <tr><th className={`px-6 py-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Code</th><th className={`px-6 py-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Subject</th><th className={`px-6 py-4 text-center ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Units</th><th className={`px-6 py-4 text-center ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Midterm</th><th className={`px-6 py-4 text-center ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Final</th><th className={`px-6 py-4 text-center ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Status</th></tr>
                                            </thead>
                                            <tbody className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-100'}`}>
                                                {(viewing.enrolledCourseGradeDetails || viewing.studentGradeHistoryData || []).map((c: any, i: number) => {
                                                    const midterm = c.gradeDetails?.find((g: any) => g.periodName === "Midterm")?.grade || "-";
                                                    const finalGrade = c.gradeDetailFinal?.grade;
                                                    const isPassed = c.gradeDetailFinal?.remarks?.toUpperCase() === "PASSED" || c.remarks?.toUpperCase() === "PASSED";
                                                    const isFailed = c.gradeDetailFinal?.remarks?.toUpperCase() === "FAILED" || c.remarks?.toUpperCase() === "FAILED";
                                                    const isFivePoint = finalGrade === "5" || finalGrade === "5.0";
                                                    return (
                                                        <tr key={i} className={`transition-colors ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                                                            <td className={`px-6 py-4 font-mono text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{c.courseCode}</td>
                                                            <td className={`px-6 py-4 text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>{c.courseTitle}</td>
                                                            <td className={`px-6 py-4 text-center text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{c.units}</td>
                                                            <td className={`px-6 py-4 text-center font-mono text-xs transition-all ${!showGrades && midterm !== "-" ? 'blur-[3px] opacity-30 select-none' : (theme === 'dark' ? 'text-white' : 'text-gray-900')}`}>{midterm}</td>
                                                            <td className={`px-6 py-4 text-center font-bold text-xs transition-all ${!showGrades ? 'blur-[3px] opacity-30 select-none' : (isFivePoint ? 'text-blue-500' : (theme === 'dark' ? 'text-white' : 'text-gray-900'))}`}>{finalGrade || "-"}</td>
                                                            <td className="px-6 py-4 text-center">
                                                                <div className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-lg uppercase ${isPassed ? (theme === 'dark' ? 'text-green-400 bg-green-950/30' : 'text-green-700 bg-green-50') : isFailed ? (theme === 'dark' ? 'text-red-400 bg-red-950/30' : 'text-red-700 bg-red-50') : (theme === 'dark' ? 'text-gray-400 bg-gray-700/50' : 'text-gray-500 bg-gray-50')}`}>
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

function InfoWindow({ type, onClose, thresholds, basis, showGrades, theme }: any) {
    const isDeans = type === 'deans';
    return (
        <div className={`fixed inset-0 z-[60] flex items-center justify-center p-4 transition-colors ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'} backdrop-blur-sm`}>
            <div className={`w-full max-w-sm p-8 rounded-lg border transition-colors ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className={`flex items-center gap-4 mb-6 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                    {isDeans ? <Award size={32} /> : <Star size={32} />}
                    <h2 className="font-bold uppercase text-lg">{isDeans ? "Dean's List" : "Parangal Award"}</h2>
                </div>
                <div className="space-y-4 mb-8">
                    <p className={`text-xs font-bold uppercase tracking-wide ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Calculation Basis (NSTP Excluded):</p>
                    {basis?.map((b: any, idx: number) => (
                        <div key={idx} className={`p-4 rounded-lg border flex justify-between items-center transition-colors ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex flex-col text-left">
                                <span className={`text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{b.year}</span>
                                <span className={`text-xs uppercase font-semibold mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{b.term}</span>
                            </div>
                            <span className={`font-bold text-lg ${!showGrades ? 'blur-[3px] opacity-40' : (theme === 'dark' ? 'text-white' : 'text-gray-900')}`}>{typeof b.gwa === 'number' ? b.gwa.toFixed(3) : b.gwa}</span>
                        </div>
                    ))}
                    <p className={`text-xs font-semibold leading-relaxed pt-4 border-t text-center ${theme === 'dark' ? 'border-gray-600 text-gray-400' : 'border-gray-200 text-gray-600'}`}>
                        {isDeans ? `Dean's List: Both semesters must be between ${thresholds.deans} and 4.399.` : `Parangal Award: Both semesters must be ${thresholds.parangal} or higher.`}
                    </p>
                </div>
                <button onClick={onClose} className={`w-full py-4 font-bold rounded-lg uppercase text-xs tracking-wider transition-all ${theme === 'dark' ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-black'}`}>Close Analysis</button>
            </div>
        </div>
    );
}

function ErrorModal({ msg, onClose, theme }: any) {
    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-colors ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'} backdrop-blur-sm`}>
            <div className={`w-full max-w-sm p-8 rounded-lg border transition-colors ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-red-200'}`}>
                <div className={`flex items-center gap-4 mb-6 font-bold uppercase tracking-tight ${theme === 'dark' ? 'text-red-400' : 'text-red-700'}`}>
                    <ShieldAlert size={24} /> System Warning
                </div>
                <p className={`text-sm mb-8 font-medium leading-relaxed ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{msg}</p>
                <button onClick={onClose} className={`w-full py-4 font-bold rounded-lg uppercase text-xs tracking-wider transition-all ${theme === 'dark' ? 'bg-red-700 text-white hover:bg-red-600' : 'bg-red-600 text-white hover:bg-red-700'}`}>Okay</button>
            </div>
        </div>
    );
}