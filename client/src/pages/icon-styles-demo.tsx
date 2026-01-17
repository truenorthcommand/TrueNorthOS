import "@/components/GlassCard.css";

export default function IconStylesDemo() {
  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Icon Style Comparison</h1>
          <p className="text-gray-500">Compare 6 different icon styles side by side</p>
        </div>

        {/* Side-by-side comparison grid */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-4 px-2 text-sm font-semibold text-gray-600 w-32">Style</th>
                <th className="text-center py-4 px-2 text-sm font-semibold text-gray-600">Active Jobs</th>
                <th className="text-center py-4 px-2 text-sm font-semibold text-gray-600">Pending Quotes</th>
                <th className="text-center py-4 px-2 text-sm font-semibold text-gray-600">Unpaid Invoices</th>
                <th className="text-center py-4 px-2 text-sm font-semibold text-gray-600">Team Members</th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1: Standard Lucide */}
              <tr className="border-b border-gray-100">
                <td className="py-4 px-2">
                  <span className="text-sm font-medium text-gray-700">1. Standard</span>
                  <span className="block text-xs text-gray-400">Lucide outline</span>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="p-3 rounded-xl bg-blue-100">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="p-3 rounded-xl bg-orange-100">
                      <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="p-3 rounded-xl bg-red-100">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                      </svg>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="p-3 rounded-xl bg-teal-100">
                      <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />
                      </svg>
                    </div>
                  </div>
                </td>
              </tr>

              {/* Row 2: Duotone */}
              <tr className="border-b border-gray-100">
                <td className="py-4 px-2">
                  <span className="text-sm font-medium text-gray-700">2. Duotone</span>
                  <span className="block text-xs text-gray-400">Two-tone fill</span>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="p-3 rounded-xl bg-blue-50">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                        <path d="M4 8C4 6.89543 4.89543 6 6 6H18C19.1046 6 20 6.89543 20 8V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V8Z" fill="#93C5FD"/>
                        <path d="M8 6V4C8 2.89543 8.89543 2 10 2H14C15.1046 2 16 2.89543 16 4V6" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M4 12H20" stroke="#2563EB" strokeWidth="2"/>
                        <circle cx="12" cy="14" r="1.5" fill="#2563EB"/>
                      </svg>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="p-3 rounded-xl bg-orange-50">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                        <path d="M6 2H14L20 8V20C20 21.1046 19.1046 22 18 22H6C4.89543 22 4 21.1046 4 20V4C4 2.89543 4.89543 2 6 2Z" fill="#FED7AA"/>
                        <path d="M14 2V8H20" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M8 13H16M8 17H12" stroke="#EA580C" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="p-3 rounded-xl bg-red-50">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                        <path d="M4 4H20V20L17 18L14 20L11 18L8 20L5 18L4 20V4Z" fill="#FECACA"/>
                        <path d="M8 8H16M8 12H14" stroke="#DC2626" strokeWidth="2" strokeLinecap="round"/>
                        <circle cx="16" cy="16" r="3" fill="#DC2626"/>
                        <path d="M16 15V16.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                        <circle cx="16" cy="17.5" r="0.5" fill="white"/>
                      </svg>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="p-3 rounded-xl bg-teal-50">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                        <circle cx="9" cy="7" r="3" fill="#5EEAD4"/>
                        <circle cx="17" cy="7" r="2" fill="#14B8A6"/>
                        <path d="M3 21V19C3 16.7909 4.79086 15 7 15H11C13.2091 15 15 16.7909 15 19V21" fill="#5EEAD4"/>
                        <path d="M15 15C16.6569 15 18 16.3431 18 18V21H21V18C21 16.3431 19.6569 15 18 15H15Z" fill="#14B8A6" fillOpacity="0.6"/>
                      </svg>
                    </div>
                  </div>
                </td>
              </tr>

              {/* Row 3: Gradient Stroke */}
              <tr className="border-b border-gray-100">
                <td className="py-4 px-2">
                  <span className="text-sm font-medium text-gray-700">3. Gradient</span>
                  <span className="block text-xs text-gray-400">Colorful stroke</span>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="p-3 rounded-xl" style={{background: 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)'}}>
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                        <defs>
                          <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#3B82F6"/>
                            <stop offset="100%" stopColor="#8B5CF6"/>
                          </linearGradient>
                        </defs>
                        <path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="url(#g1)" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="p-3 rounded-xl" style={{background: 'linear-gradient(135deg, #ffedd5 0%, #fef3c7 100%)'}}>
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                        <defs>
                          <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#F97316"/>
                            <stop offset="100%" stopColor="#EAB308"/>
                          </linearGradient>
                        </defs>
                        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="url(#g2)" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="p-3 rounded-xl" style={{background: 'linear-gradient(135deg, #fee2e2 0%, #fce7f3 100%)'}}>
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                        <defs>
                          <linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#EF4444"/>
                            <stop offset="100%" stopColor="#EC4899"/>
                          </linearGradient>
                        </defs>
                        <path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" stroke="url(#g3)" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="p-3 rounded-xl" style={{background: 'linear-gradient(135deg, #ccfbf1 0%, #cffafe 100%)'}}>
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                        <defs>
                          <linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#14B8A6"/>
                            <stop offset="100%" stopColor="#06B6D4"/>
                          </linearGradient>
                        </defs>
                        <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" stroke="url(#g4)" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                  </div>
                </td>
              </tr>

              {/* Row 4: Organic Blob */}
              <tr className="border-b border-gray-100">
                <td className="py-4 px-2">
                  <span className="text-sm font-medium text-gray-700">4. Blob</span>
                  <span className="block text-xs text-gray-400">Organic shapes</span>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="relative w-12 h-12">
                      <svg className="absolute inset-0 w-12 h-12" viewBox="0 0 48 48">
                        <ellipse cx="24" cy="24" rx="18" ry="16" fill="#93C5FD" opacity="0.5" transform="rotate(15 24 24)"/>
                        <ellipse cx="24" cy="24" rx="14" ry="12" fill="#3B82F6" opacity="0.3" transform="rotate(-10 24 24)"/>
                      </svg>
                      <svg className="absolute inset-0 w-12 h-12 p-3" viewBox="0 0 24 24" fill="none">
                        <path d="M20 7H4M20 7V17C20 18.1 19.1 19 18 19H6C4.9 19 4 18.1 4 17V7M20 7L18 3H6L4 7" stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="relative w-12 h-12">
                      <svg className="absolute inset-0 w-12 h-12" viewBox="0 0 48 48">
                        <ellipse cx="24" cy="24" rx="18" ry="16" fill="#FDBA74" opacity="0.5" transform="rotate(-15 24 24)"/>
                        <ellipse cx="24" cy="24" rx="14" ry="12" fill="#F97316" opacity="0.3" transform="rotate(10 24 24)"/>
                      </svg>
                      <svg className="absolute inset-0 w-12 h-12 p-3" viewBox="0 0 24 24" fill="none">
                        <path d="M14 2H6C5 2 4 3 4 4V20C4 21 5 22 6 22H18C19 22 20 21 20 20V8L14 2ZM14 2V8H20M12 18V12M9 15H15" stroke="#C2410C" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="relative w-12 h-12">
                      <svg className="absolute inset-0 w-12 h-12" viewBox="0 0 48 48">
                        <ellipse cx="24" cy="24" rx="18" ry="16" fill="#FCA5A5" opacity="0.5" transform="rotate(20 24 24)"/>
                        <ellipse cx="24" cy="24" rx="14" ry="12" fill="#EF4444" opacity="0.3" transform="rotate(-5 24 24)"/>
                      </svg>
                      <svg className="absolute inset-0 w-12 h-12 p-3" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2ZM12 8V12L15 15" stroke="#B91C1C" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="relative w-12 h-12">
                      <svg className="absolute inset-0 w-12 h-12" viewBox="0 0 48 48">
                        <circle cx="24" cy="24" r="18" fill="#5EEAD4" opacity="0.4"/>
                        <circle cx="20" cy="20" r="12" fill="#14B8A6" opacity="0.3"/>
                      </svg>
                      <svg className="absolute inset-0 w-12 h-12 p-3" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="8" r="4" stroke="#0F766E" strokeWidth="2"/>
                        <path d="M4 20C4 17 7.6 14 12 14S20 17 20 20" stroke="#0F766E" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                  </div>
                </td>
              </tr>

              {/* Row 5: Glowing Badge */}
              <tr className="border-b border-gray-100">
                <td className="py-4 px-2">
                  <span className="text-sm font-medium text-gray-700">5. Glow Badge</span>
                  <span className="block text-xs text-gray-400">Ring + glow</span>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-blue-400 blur-md opacity-50"></div>
                      <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 p-0.5">
                        <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-orange-400 blur-md opacity-50"></div>
                      <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 p-0.5">
                        <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                          <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-red-400 blur-md opacity-50"></div>
                      <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-red-600 p-0.5">
                        <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-teal-400 blur-md opacity-50"></div>
                      <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 p-0.5">
                        <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                          <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>

              {/* Row 6: 3D Style */}
              <tr className="border-b border-gray-100">
                <td className="py-4 px-2">
                  <span className="text-sm font-medium text-gray-700">6. 3D</span>
                  <span className="block text-xs text-gray-400">Emoji-inspired</span>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-blue-400 to-blue-600 flex items-center justify-center" style={{boxShadow: '0 4px 0 #1d4ed8, 0 6px 12px rgba(37, 99, 235, 0.4)'}}>
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 6H4V18H20V6ZM20 4C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4H20ZM11 7H13V9H11V7ZM11 11H13V17H11V11Z"/>
                      </svg>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-orange-400 to-orange-600 flex items-center justify-center" style={{boxShadow: '0 4px 0 #c2410c, 0 6px 12px rgba(234, 88, 12, 0.4)'}}>
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM16 18H8V16H16V18ZM16 14H8V12H16V14ZM13 9V3.5L18.5 9H13Z"/>
                      </svg>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-red-400 to-red-600 flex items-center justify-center" style={{boxShadow: '0 4px 0 #b91c1c, 0 6px 12px rgba(220, 38, 38, 0.4)'}}>
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 3H5C3.9 3 3 3.9 3 5V19L7 15H19C20.1 15 21 14.1 21 13V5C21 3.9 20.1 3 19 3ZM12 12L10.5 9H13.5L12 12ZM13 8H11V6H13V8Z"/>
                      </svg>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-center">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-teal-400 to-teal-600 flex items-center justify-center" style={{boxShadow: '0 4px 0 #0f766e, 0 6px 12px rgba(20, 184, 166, 0.4)'}}>
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16 11C17.66 11 19 9.66 19 8C19 6.34 17.66 5 16 5C14.34 5 13 6.34 13 8C13 9.66 14.34 11 16 11ZM8 11C9.66 11 11 9.66 11 8C11 6.34 9.66 5 8 5C6.34 5 5 6.34 5 8C5 9.66 6.34 11 8 11ZM8 13C5.67 13 1 14.17 1 16.5V19H15V16.5C15 14.17 10.33 13 8 13ZM16 13C15.71 13 15.38 13.02 15.03 13.05C16.19 13.89 17 15.02 17 16.5V19H23V16.5C23 14.17 18.33 13 16 13Z"/>
                      </svg>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="text-center pt-8 pb-4">
          <a href="/glass-dashboard" className="text-gray-400 hover:text-gray-600 text-sm underline">
            Back to Dashboard Demo
          </a>
          <span className="text-gray-300 mx-3">|</span>
          <a href="/" className="text-gray-400 hover:text-gray-600 text-sm underline">
            Back to App
          </a>
        </div>
      </div>
    </div>
  );
}
