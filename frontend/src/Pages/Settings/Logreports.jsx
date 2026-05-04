import Topbar from '../../Components/notif/Topbar'
import Sidebar from '../../Components/sidebar/Sidebar'
import React, { useState, useEffect } from "react"
import back from '../../Assets/back.png'
import './Logreports.css'
import { useNavigate } from "react-router-dom"

const Logreports = () => {
  const navigate = useNavigate()

  const getUserFromStorage = () => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw || raw === 'undefined') return {};
      return JSON.parse(raw);
    } catch { return {}; }
  };

  const storedUser = getUserFromStorage();

  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [searchTerm, setSearchTerm] = useState("")

  // Fetch logs — admin sees all, cashier sees only their own
  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true)
      try {
        let url = ''

        if (fromDate && toDate) {
          // Date range filter
          url = `${import.meta.env.VITE_API_URL}/api/logs/date?start=${fromDate}&end=${toDate}`
        } else if (storedUser.role === 'admin') {
          // Admin: all logs
          url = `${import.meta.env.VITE_API_URL}/api/logs/`
        } else {
          // Cashier: only their logs
          url = `${import.meta.env.VITE_API_URL}/api/logs/user/${storedUser._id}`
        }

        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch logs')
        const data = await res.json()
        setLogs(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [fromDate, toDate])

  // Midnight auto-refresh
  useEffect(() => {
    const now = new Date()
    const midnight = new Date()
    midnight.setHours(24, 0, 0, 0)
    const timer = setTimeout(() => window.location.reload(), midnight - now)
    return () => clearTimeout(timer)
  }, [])

  const getDateHeader = (dateString) => {
    const activityDate = new Date(dateString)
    const today = new Date()
    const yesterday = new Date()

    activityDate.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    yesterday.setDate(today.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)

    if (activityDate.getTime() === today.getTime()) return "TODAY"
    if (activityDate.getTime() === yesterday.getTime()) return "YESTERDAY"

    return activityDate.toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric"
    })
  }

  const formatTime = (dateTime) =>
    new Date(dateTime).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit"
    })

  // Build display message from log entry
  const getLogMessage = (log) => {
    const name = log.user
      ? `${log.user.first_name} ${log.user.last_name}`
      : 'Unknown User'
    const role = log.user?.role || ''

    if (log.timeOut) {
      return `${name} (${role}) logged out`
    }
    return `${name} (${role}) logged in`
  }

  // Filter by search term
  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true
    const name = log.user
      ? `${log.user.first_name} ${log.user.last_name}`.toLowerCase()
      : ''
    const role = log.user?.role?.toLowerCase() || ''
    const term = searchTerm.toLowerCase()
    return name.includes(term) || role.includes(term)
  })

  // Group by date header
  const groupedLogs = () => {
    const grouped = {}
    filteredLogs.forEach((log) => {
      const header = getDateHeader(log.timeIn)
      if (!grouped[header]) grouped[header] = []
      grouped[header].push(log)
    })
    return grouped
  }

  const grouped = groupedLogs()

  return (
    <div className='lreports-container'>
      <Sidebar />

      <div className='store-information'>
        <Topbar />

        <div className='logreports-content'>
          <div className='settings-sidebar'>
            <div className='settings-header'>
              <button>
                <img src={back} className='back' alt='back' onClick={() => navigate("/dashboard")} />
              </button>
              <p>Settings</p>
            </div>

            <div className='settings-nav'>
              <ul>
                <li onClick={() => navigate("/storeinformation")}>Store Information</li>
                <li onClick={() => navigate("/usermanagement")}>User Management</li>
                <li className='info'>Log Reports</li>
                <li onClick={() => navigate("/Systempreferences")}>System Preferences</li>
                <li onClick={() => navigate("/backuprecovery")}>Backup & Recovery</li>
              </ul>
            </div>
          </div>

          <div className='logreports-container'>
            <h2>Activity Log</h2>

            <div className='logs-filter'>
              <input
                type="search"
                placeholder="Search by name or role..."
                className='logs-search'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <div className='log-date'>
                <p>Date: </p>
                <p>From:</p>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                <span>-</span>
                <p>To:</p>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                {(fromDate || toDate) && (
                  <button
                    onClick={() => { setFromDate(''); setToDate(''); }}
                    style={{ marginLeft: '8px', cursor: 'pointer' }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className='user-activity'>
              {loading ? (
                <p style={{ padding: '20px', color: '#888' }}>Loading logs...</p>
              ) : Object.keys(grouped).length === 0 ? (
                <p style={{ padding: '20px', color: '#888' }}>No activity logs found.</p>
              ) : (
                Object.keys(grouped).map((date) => (
                  <div key={date} className='log-header'>
                    <h3>{date}</h3>

                    {grouped[date].map((log) => (
                      <div key={log._id} className="card">
                        {/* User avatar */}
                        {log.user?.image ? (
                          <img src={log.user.image} alt="avatar" />
                        ) : (
                          <div className='no-image' style={{
                            width: 40, height: 40, borderRadius: '50%',
                            background: '#ddd', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, color: '#888', flexShrink: 0
                          }}>
                            {log.user?.first_name?.[0]}{log.user?.last_name?.[0]}
                          </div>
                        )}

                        <div className='notification-sched'>
                          <div className='notif-message'>
                            <div>{getLogMessage(log)}</div>
                            <div>{formatTime(log.timeIn)}</div>
                          </div>

                          <div className='date-time'>
                            <div>{new Date(log.timeIn).toLocaleDateString()}</div>
                            {log.timeOut && (
                              <div>Out: {formatTime(log.timeOut)}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Logreports