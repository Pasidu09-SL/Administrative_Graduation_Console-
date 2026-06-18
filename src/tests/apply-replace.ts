import fs from 'fs';
import path from 'path';

function main() {
  const filePath = path.resolve('src/app/admin/page.tsx');
  let content = fs.readFileSync(filePath, 'utf8');

  // Normalize line endings to LF for easier replacement
  const isCrlf = content.includes('\r\n');
  content = content.replace(/\r\n/g, '\n');

  const startMarker = '{/* 5. SESSION MANAGEMENT & SEATING ALLOCATION WORKSPACE */}';
  const endMarker = '{/* 6. CERTIFICATE PRINT WORKSPACE */}';

  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    console.error('Markers not found!');
    return;
  }

  const replacement = `          {/* SESSION ALLOCATION WORKSPACE */}
          {activeTab === "session_allocation" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-955 dark:text-white">Session Mapping Control</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Define dates, times, and map student seating groups (faculties/externals) to graduation sessions.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Allocator Form */}
                <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl lg:col-span-1 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-slate-950 dark:text-white">
                      Map Group to Session
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-500">
                      Select group, session, and configure date & time parameters.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form
                      onSubmit={handleSaveSessionAllocation}
                      className="space-y-4"
                    >
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="sessAllocGroupSelect"
                          className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                        >
                          Graduation Seating Group
                        </Label>
                        <select
                          id="sessAllocGroupSelect"
                          value={sessAllocGroup}
                          onChange={(e) => setSessAllocGroup(e.target.value)}
                          className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-300 px-3 py-2 rounded-lg focus:outline-none"
                        >
                          <option value="">Select Seating Group</option>
                          {FACULTIES.map((fac) => (
                            <option key={fac} value={\`\${fac} (Internal)\`}>
                              {fac} (Internal)
                            </option>
                          ))}
                          <option value="All External Degrees">
                            All External Degrees
                          </option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor="sessAllocSessionSelect"
                          className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                        >
                          Target Session
                        </Label>
                        <select
                          id="sessAllocSessionSelect"
                          value={sessAllocSession}
                          onChange={(e) => setSessAllocSession(e.target.value)}
                          className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-300 px-3 py-2 rounded-lg focus:outline-none"
                        >
                          <option value="">Select Session</option>
                          {SESSIONS.map((sessNum) => (
                            <option key={sessNum} value={String(sessNum)}>
                              Session {sessNum}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor="sessAllocDateInput"
                          className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                        >
                          Session Date (e.g. 2026-07-25)
                        </Label>
                        <Input
                          id="sessAllocDateInput"
                          type="text"
                          value={sessAllocDate}
                          onChange={(e) => setSessAllocDate(e.target.value)}
                          placeholder="e.g. 25th July 2026"
                          className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs rounded-lg h-9"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor="sessAllocTimeInput"
                          className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                        >
                          Session Time (e.g. 09:00 AM)
                        </Label>
                        <Input
                          id="sessAllocTimeInput"
                          type="text"
                          value={sessAllocTime}
                          onChange={(e) => setSessAllocTime(e.target.value)}
                          placeholder="e.g. 09:00 AM"
                          className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs rounded-lg h-9"
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs rounded-lg mt-2 flex items-center justify-center gap-1.5 shadow"
                      >
                        {loading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        Save Mapping
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Session Slots Overview */}
                <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl lg:col-span-2 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-slate-955 dark:text-white">
                      Graduation Session Slots
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-500">
                      Overview of graduation sessions and mapped faculties.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {convocationSessions.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-600 font-semibold italic">
                        No sessions configured in Faculty & Session Management.
                      </div>
                    ) : (
                      convocationSessions.map((session) => {
                        const hasFaculty1 = !!session.faculty_1;
                        const hasFaculty2 = !!session.faculty_2;
                        
                        return (
                          <div
                            key={session.id}
                            className="p-4 bg-white dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                  {session.session_name || \`Session \${session.session_number}\`}
                                </span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
                                  Session {session.session_number}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 space-y-0.5">
                                <div>
                                  <span className="font-semibold">Date:</span> {session.session_date || "Not configured"}
                                </div>
                                <div>
                                  <span className="font-semibold">Time:</span> {session.session_time || "Not configured"}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-1 md:justify-end gap-3 flex-wrap">
                              {!hasFaculty1 && !hasFaculty2 ? (
                                <span className="text-xs text-slate-400 dark:text-slate-600 font-semibold italic flex items-center">
                                  No groups allocated
                                </span>
                              ) : (
                                <>
                                  {hasFaculty1 && (
                                    <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center gap-3 text-xs">
                                      <div>
                                        <span className="font-bold text-blue-600 dark:text-blue-400 block leading-none">
                                          {session.faculty_1}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleClearSessionAllocation(session.faculty_1)}
                                        className="p-0.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 rounded transition"
                                        title={\`Clear allocation for \${session.faculty_1}\`}
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                  {hasFaculty2 && (
                                    <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center gap-3 text-xs">
                                      <div>
                                        <span className="font-bold text-blue-600 dark:text-blue-400 block leading-none">
                                          {session.faculty_2}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleClearSessionAllocation(session.faculty_2)}
                                        className="p-0.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 rounded transition"
                                        title={\`Clear allocation for \${session.faculty_2}\`}
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* SEATING ALLOCATION WORKSPACE */}
          {activeTab === "seating" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-950 dark:text-white">Seating Allocation Control</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Run sequential seating and certificate numbering algorithms for student groups after session assignments.
                </p>
              </div>

              <div className="space-y-4">
                {sessionAllocations.length === 0 ? (
                  <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm p-6 text-center">
                    <span className="text-xs text-slate-400 dark:text-slate-600 font-semibold italic">
                      No groups found. Please configure faculties and ingest students first.
                    </span>
                  </Card>
                ) : (
                  sessionAllocations.map((group) => {
                    const hasSession = group.sessionNumber !== null;
                    const canAllocate = hasSession && group.totalAttendingCount > 0;
                    
                    return (
                      <Card
                        key={group.groupName}
                        className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm overflow-hidden"
                      >
                        <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                          {/* Group Info & Stats */}
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-3 flex-wrap">
                              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                {group.groupName}
                              </h3>
                              
                              {/* Session Badge */}
                              {hasSession ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
                                  Session {group.sessionNumber} ({group.sessionDate} at {group.sessionTime})
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-950/30">
                                  No Session Allocated
                                </span>
                              )}

                              {/* Seating Allocation Status Badge */}
                              {group.totalAttendingCount === 0 ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                  No Candidates Attending
                                </span>
                              ) : group.isSeatingAllocated ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 flex items-center gap-1">
                                  <Check className="h-3 w-3" /> Allocated
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 flex items-center gap-1 animate-pulse">
                                  <AlertCircle className="h-3 w-3" /> Pending Seating
                                </span>
                              )}
                            </div>

                            {/* Attending count summary */}
                            <div className="text-xs text-slate-500">
                              <span className="font-semibold text-slate-700 dark:text-slate-350">
                                {group.totalAttendingCount} Approved Candidates Attending
                              </span>{" "}
                              across {group.degreeCount} academic programs.
                            </div>

                            {/* Degrees list */}
                            {group.degrees.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {group.degrees.map((deg: any) => (
                                  <span
                                    key={deg.id}
                                    className="text-[9px] font-bold px-2 py-0.5 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-md border border-slate-200 dark:border-slate-800/80"
                                  >
                                    {deg.name}: {deg.attendingCount} Attending
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Seating Actions */}
                          <div className="flex items-center gap-2 lg:self-center shrink-0">
                            {/* Allocate Seating Button */}
                            <Button
                              onClick={() => handleTriggerSeatingAllocation(group.groupName)}
                              disabled={loading || !canAllocate || group.isSeatingAllocated}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs rounded-lg px-4 flex items-center gap-1.5 shadow disabled:opacity-50"
                            >
                              {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <UserCheck className="h-4 w-4" />
                              )}
                              Allocate Seating
                            </Button>

                            {/* Clear Seating Button */}
                            <Button
                              variant="outline"
                              onClick={() => handleClearSeatingAllocation(group.groupName)}
                              disabled={loading || (!group.isSeatingAllocated && group.totalAttendingCount > 0 && !group.degrees.some((d: any) => d.attendingCount > 0))}
                              className="border-slate-200 dark:border-slate-800 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-bold h-9 rounded-lg px-3 flex items-center gap-1.5"
                            >
                              <Trash2 className="h-4 w-4" />
                              Clear Seating
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          )}
          
`;

  const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);

  // Restore line endings
  const finalContent = isCrlf ? newContent.replace(/\n/g, '\r\n') : newContent;
  fs.writeFileSync(filePath, finalContent, 'utf8');
  console.log('Successfully replaced workspaces!');
}

main();
