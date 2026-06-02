"use client";

import { useState } from 'react';
import { 
  LogOut, ShieldAlert, Award, Star, CheckCircle2, XCircle, ShieldCheck,
  Eye, EyeOff, Instagram
} from 'lucide-react';

export default function GradePortal() {
    const [creds, setCreds] = useState({ id: "", pw: "" });
    const [showGrades, setShowGrades] = useState(true);
    const [modal, setModal] = useState<{ show: boolean, msg: string }>({ show: false, msg: "" });
    const [infoModal, setInfoModal] = useState<{ show: boolean, type: 'deans' | 'parangal' | null }>({ show: false, type: null });
    
    const [authLoading, setAuthLoading] = useState(false);
    const [gradesLoading, setGradesLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [grades, setGrades] = useState<any[]>([]);
    const [viewing, setViewing] = useState<any>(null);

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
            <div className="flex items-center justify-center min-h-screen p-4 bg-white">
                {modal.show && <ErrorModal msg={modal.msg} onClose={() => setModal({ show: false, msg: "" })} />}
                <div className="w-full max-w-sm p-8 border border-gray-200 rounded-lg">
                    <h1 className="text-3xl font-bold text-center mb-8 text-gray-900" style={{ fontFamily: 'Lexend' }}>ALT WITS</h1>
                    <div className="space-y-4">
                        <input 
                            className="w-full border border-gray-300 p-4 rounded-lg outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all text-gray-900 placeholder-gray-500" 
                            placeholder="Student ID" 
                            value={creds.id} 
                            onChange={e => setCreds({...creds, id: e.target.value})} 
                        />
                        <input 
                            className="w-full border border-gray-300 p-4 rounded-lg outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all text-gray-900 placeholder-gray-500" 
                            placeholder="Password" 
                            type="password" 
                            value={creds.pw} 
                            onChange={e => setCreds({...creds, pw: e.target.value})} 
                        />
                        <button 
                            onClick={startAuth} 
                            disabled={authLoading} 
                            className="w-full bg-gray-900 hover:bg-black text-white py-4 rounded-lg font-bold transition-all disabled:opacity-50 uppercase text-sm tracking-wider"
                        >
                            {authLoading ? "SIGNING IN..." : "SIGN IN"}
                        </button>
                    </div>
                    <div className="mt-8 pt-6 border-t border-gray-200 text-center space-y-2">
                        <p className="text-xs text-gray-600 flex items-center justify-center gap-1">
                            UPD by: <Instagram size={12} />{" "}
                            <a href="https://www.instagram.com/brzy.y4/" target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:underline font-semibold">@brzy.y4</a>
                        </p>
                        <p className="text-[10px] text-gray-400">INSPO: @mrxception</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4 md:p-8 bg-white text-gray-900">
            {modal.show && <ErrorModal msg={modal.msg} onClose={() => setModal({ show: false, msg: "" })} />}
            {infoModal.show && (
                <InfoWindow 
                    type={infoModal.type} 
                    onClose={() => setInfoModal({ show: false, type: null })} 
                    thresholds={{ deans: DEANS_MIN, parangal: PARANGAL_MIN }}
                    basis={awardInfo.basis}
                    showGrades={showGrades}
                />
            )}

            <div className="max-w-6xl mx-auto">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 p-6 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-5">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{data.userInfo?.fullName}</h2>
                            <div className="flex gap-3 text-xs text-gray-600"><span>ID: {data.userInfo?.studentId}</span></div>
                        </div>
                    </div>
                    <button onClick={() => window.location.reload()} className="flex items-center gap-2 px-5 py-3 text-xs font-bold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-all"><LogOut size={14} /></button>
                </header>

                

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <aside className="space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4 text-left">Academic History</h3>
                        {gradesLoading ? [1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-lg animate-pulse bg-gray-100" />) : 
                            grades?.map((en, i) => (
                                <div key={i} onClick={() => setViewing(en)} className={`p-5 rounded-lg cursor-pointer border transition-all ${viewing === en ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 hover:border-gray-400 bg-white'}`}>
                                    <div>
                                        <div className={`font-bold text-xs uppercase ${viewing === en ? 'text-white' : 'text-gray-900'}`}>{en.academicYear}</div>
                                        <div className="text-xs text-gray-600 uppercase font-semibold mt-1">{en.term}</div>
                                    </div>
                                </div>
                            ))
                        }
                    </aside>

                    <main className="lg:col-span-3">
                        {gradesLoading ? (
                            <div className="h-96 border border-gray-200 rounded-lg flex items-center justify-center bg-white"><div className="animate-spin w-10 h-10 border-4 border-gray-300 border-t-gray-900 rounded-full" /></div>
                        ) : viewing ? (
                            <div className="space-y-6">
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex flex-wrap gap-3">
                                        {awardInfo.deans && (
                                            <button onClick={() => setInfoModal({ show: true, type: 'deans' })} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 transition-all font-semibold text-xs uppercase">
                                                <Award size={16} /> Dean's Lister
                                            </button>
                                        )}
                                        {awardInfo.parangal && (
                                            <button onClick={() => setInfoModal({ show: true, type: 'parangal' })} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 transition-all font-semibold text-xs uppercase">
                                                <Star size={16} /> Parangal Awardee
                                            </button>
                                        )}
                                    </div>
                                    <button onClick={() => setShowGrades(!showGrades)} className="flex items-center gap-3 px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border border-gray-300 text-gray-900 hover:bg-gray-100 transition-all">
                                        {showGrades ? <EyeOff size={16} /> : <Eye size={16} />} {showGrades ? "Hide Grades" : "Show Grades"}
                                    </button>
                                </div>

                                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                    <div className="p-6 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-6 bg-gray-50">
                                        <div className="text-left">
                                            <h3 className="text-base font-bold uppercase tracking-wide text-gray-900">{viewing.academicYear}</h3>
                                            <p className="text-xs text-gray-600 font-semibold uppercase mt-1">{viewing.term}</p>
                                        </div>
                                        <div className="flex gap-4 text-xs font-mono font-bold">
                                            <div className="px-4 py-2 rounded-lg border border-gray-300 text-gray-900 bg-white">GWA: {viewing.gwa}</div>
                                            <div className="px-4 py-2 rounded-lg border border-gray-300 text-gray-900 bg-white">Units: {viewing.totalUnits}</div>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="text-xs font-bold uppercase tracking-wide bg-gray-50 border-b border-gray-200">
                                                <tr><th className="px-6 py-4 text-gray-900">Code</th><th className="px-6 py-4 text-gray-900">Subject</th><th className="px-6 py-4 text-center text-gray-600">Units</th><th className="px-6 py-4 text-center text-gray-900">Midterm</th><th className="px-6 py-4 text-center text-gray-900">Final</th><th className="px-6 py-4 text-center text-gray-900">Status</th></tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {(viewing.enrolledCourseGradeDetails || viewing.studentGradeHistoryData || []).map((c: any, i: number) => {
                                                    const midterm = c.gradeDetails?.find((g: any) => g.periodName === "Midterm")?.grade || "-";
                                                    const finalGrade = c.gradeDetailFinal?.grade;
                                                    const isPassed = c.gradeDetailFinal?.remarks?.toUpperCase() === "PASSED" || c.remarks?.toUpperCase() === "PASSED";
                                                    const isFailed = c.gradeDetailFinal?.remarks?.toUpperCase() === "FAILED" || c.remarks?.toUpperCase() === "FAILED";
                                                    const isFivePoint = finalGrade === "5" || finalGrade === "5.0";
                                                    return (
                                                        <tr key={i} className="hover:bg-gray-50 transition-all">
                                                            <td className="px-6 py-4 font-mono text-xs text-gray-900 font-bold">{c.courseCode}</td>
                                                            <td className="px-6 py-4 text-xs text-gray-900">{c.courseTitle}</td>
                                                            <td className="px-6 py-4 text-center text-xs text-gray-500">{c.units}</td>
                                                            <td className={`px-6 py-4 text-center font-mono text-xs ${!showGrades && midterm !== "-" ? 'blur-[3px] opacity-30 select-none' : 'text-gray-900'}`}>{midterm}</td>
                                                            <td className={`px-6 py-4 text-center font-bold text-xs transition-all ${!showGrades ? 'blur-[3px] opacity-30 select-none' : (isFivePoint ? 'text-blue-600' : 'text-gray-900')}`}>{finalGrade || "-"}</td>
                                                            <td className="px-6 py-4 text-center">
                                                                <div className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-lg uppercase ${isPassed ? 'text-green-700 bg-green-50' : isFailed ? 'text-red-700 bg-red-50' : 'text-gray-500 bg-gray-50'}`}>
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

function InfoWindow({ type, onClose, thresholds, basis, showGrades }: any) {
    const isDeans = type === 'deans';
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
            <div className="w-full max-w-sm p-8 rounded-lg border border-gray-200 bg-white">
                <div className="flex items-center gap-4 mb-6 text-gray-900">
                    {isDeans ? <Award size={32} /> : <Star size={32} />}
                    <h2 className="font-bold uppercase text-lg">{isDeans ? "Dean's List" : "Parangal Award"}</h2>
                </div>
                <div className="space-y-4 mb-8">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-700">Calculation Basis (NSTP Excluded):</p>
                    {basis?.map((b: any, idx: number) => (
                        <div key={idx} className="p-4 rounded-lg border border-gray-200 flex justify-between items-center bg-gray-50">
                            <div className="flex flex-col text-left">
                                <span className="text-xs font-bold text-gray-900">{b.year}</span>
                                <span className="text-xs text-gray-600 uppercase font-semibold mt-0.5">{b.term}</span>
                            </div>
                            <span className={`font-bold text-lg ${!showGrades ? 'blur-[3px] opacity-40' : 'text-gray-900'}`}>{typeof b.gwa === 'number' ? b.gwa.toFixed(3) : b.gwa}</span>
                        </div>
                    ))}
                    <p className="text-xs text-gray-600 font-semibold leading-relaxed pt-4 border-t border-gray-200 text-center">
                        {isDeans ? `Dean's List: Both semesters must be between ${thresholds.deans} and 4.399.` : `Parangal Award: Both semesters must be ${thresholds.parangal} or higher.`}
                    </p>
                </div>
                <button onClick={onClose} className="w-full py-4 bg-gray-900 text-white font-bold rounded-lg uppercase text-xs tracking-wider hover:bg-black transition-all">Close Analysis</button>
            </div>
        </div>
    );
}

function ErrorModal({ msg, onClose }: any) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
            <div className="w-full max-w-sm p-8 rounded-lg border border-red-200 bg-white">
                <div className="flex items-center gap-4 text-red-700 mb-6 font-bold uppercase tracking-tight">
                    <ShieldAlert size={24} /> System Warning
                </div>
                <p className="text-sm text-gray-700 mb-8 font-medium leading-relaxed">{msg}</p>
                <button onClick={onClose} className="w-full py-4 bg-red-600 text-white font-bold rounded-lg uppercase text-xs tracking-wider hover:bg-red-700 transition-all">Okay</button>
            </div>
        </div>
    );
}