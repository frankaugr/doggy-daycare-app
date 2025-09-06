import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { Dog, ServiceType, AttendanceEntry, RecurringSchedule } from '../App';

interface CalendarProps {
  dogs: Dog[];
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  attendance: Record<string, AttendanceEntry>;
}

// Utility function to format date as YYYY-MM-DD in local timezone
const formatDateString = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

export default function Calendar({ dogs }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [attendance, setAttendance] = useState<Record<string, Record<string, AttendanceEntry>>>({});
  const [recurringSchedules, setRecurringSchedules] = useState<RecurringSchedule[]>([]);

  useEffect(() => {
    loadRecurringSchedules();
    loadMonthAttendance();
  }, [currentDate]);

  const loadRecurringSchedules = async () => {
    try {
      const schedules = await invoke<RecurringSchedule[]>('get_recurring_schedules');
      setRecurringSchedules(schedules);
    } catch (error) {
      console.error('Failed to load recurring schedules:', error);
    }
  };

  const loadMonthAttendance = async () => {
    try {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      // Ensure recurring attendance is generated for this month
      await invoke('generate_recurring_attendance', {
        startDate: formatDateString(monthStart),
        endDate: formatDateString(monthEnd),
      });
      
      const attendanceData: Record<string, Record<string, AttendanceEntry>> = {};
      
      for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDateString(d);
        
        // Backend now handles merging legacy and detailed attendance
        const dayAttendance = await invoke<Record<string, AttendanceEntry>>('get_attendance_for_date', { date: dateStr });
        attendanceData[dateStr] = dayAttendance;
      }
      
      setAttendance(attendanceData);
    } catch (error) {
      console.error('Failed to load attendance:', error);
    }
  };

  const generateCalendarDays = (): CalendarDay[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const firstCalendarDay = new Date(firstDayOfMonth);
    firstCalendarDay.setDate(firstCalendarDay.getDate() - firstDayOfMonth.getDay());
    
    const days: CalendarDay[] = [];
    const currentCalendarDay = new Date(firstCalendarDay);
    
    for (let i = 0; i < 42; i++) {
      const dateStr = formatDateString(currentCalendarDay);
      days.push({
        date: new Date(currentCalendarDay),
        isCurrentMonth: currentCalendarDay.getMonth() === month,
        attendance: attendance[dateStr] || {}
      });
      currentCalendarDay.setDate(currentCalendarDay.getDate() + 1);
    }
    
    return days;
  };

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    // Set to first day of month to avoid day overflow issues
    newDate.setDate(1);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const handleDayClick = (day: CalendarDay) => {
    if (day.isCurrentMonth) {
      setSelectedDate(day.date);
      setShowAttendanceModal(true);
    }
  };

  const updateAttendance = async (
    dogId: string,
    serviceType: ServiceType,
    attending: boolean,
    dropOffTime?: string,
    pickUpTime?: string,
    notes?: string,
    skipHouseholdSync: boolean = false
  ) => {
    if (!selectedDate) return;
    
    try {
      const dateStr = formatDateString(selectedDate);
      
      // Find the dog and get their household
      const dog = dogs.find(d => d.id === dogId);
      // Only update household if not skipping sync AND dog has household
      const dogsToUpdate = skipHouseholdSync || !dog?.household_id 
        ? [dog].filter(Boolean)
        : dogs.filter(d => d.household_id === dog.household_id);
      
      // Update attendance for all dogs in the household
      for (const targetDog of dogsToUpdate) {
        if (!targetDog) continue;
        
        // Preserve half-day information from Daily Checklist if no notes provided
        const existingEntryKey = `${targetDog.id}_${serviceType}`;
        const existingEntry = attendance[dateStr]?.[existingEntryKey];
        const hasHalfDayInfo = existingEntry?.notes?.includes('Half-day');
        
        let finalNotes = notes ? (dogsToUpdate.length > 1 ? `${notes} (household sync)` : notes) : null;
        
        // If no user notes provided and existing entry has half-day info, preserve it
        if (!notes && hasHalfDayInfo && attending) {
          finalNotes = existingEntry.notes || null;
        }
        
        await invoke('update_detailed_attendance', {
          date: dateStr,
          dogId: targetDog.id,
          serviceType,
          attending,
          dropOffTime: dropOffTime || null,
          pickUpTime: pickUpTime || null,
          notes: finalNotes,
        });
        
        // If this is a daycare service, also update the legacy attendance for daily checklist sync
        if (serviceType === ServiceType.Daycare) {
          await invoke('update_attendance', { 
            date: dateStr, 
            dogId: targetDog.id, 
            attending 
          });
          
          // If times are provided, also update the daily record
          if (attending && (dropOffTime || pickUpTime)) {
            const currentRecord = {
              drop_off_time: dropOffTime || undefined,
              pick_up_time: pickUpTime || undefined,
            };
            
            await invoke('update_daily_record', {
              date: dateStr,
              dogId: targetDog.id,
              record: currentRecord
            });
          }
        }
      }
      
      // Reload attendance for this day (backend handles merging)
      const dayAttendance = await invoke<Record<string, AttendanceEntry>>('get_attendance_for_date', { date: dateStr });
      
      setAttendance(prev => ({
        ...prev,
        [dateStr]: dayAttendance
      }));
    } catch (error) {
      console.error('Failed to update attendance:', error);
      alert('Failed to update attendance. Please try again.');
    }
  };



  const getAttendanceCount = (dayAttendance: Record<string, AttendanceEntry>) => {
    const attending = Object.values(dayAttendance).filter(entry => entry.attending);
    const byService = attending.reduce((acc, entry) => {
      acc[entry.service_type] = (acc[entry.service_type] || 0) + 1;
      return acc;
    }, {} as Record<ServiceType, number>);
    
    return byService;
  };

  const calendarDays = generateCalendarDays();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <div className="calendar-navigation">
          <button className="btn btn-secondary" onClick={() => navigateMonth(-1)}>
            <ChevronLeft size={16} />
          </button>
          <h2>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
          <button className="btn btn-secondary" onClick={() => navigateMonth(1)}>
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="calendar-actions">
          <button className="btn btn-primary" onClick={() => setShowScheduleModal(true)}>
            <Settings size={16} />
            View Schedules
          </button>
        </div>
      </div>

      <div className="calendar-grid">
        <div className="calendar-weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="weekday">{day}</div>
          ))}
        </div>
        
        <div className="calendar-days">
          {calendarDays.map((day, index) => {
            const attendanceCount = getAttendanceCount(day.attendance);
            const hasAttendance = Object.keys(day.attendance).length > 0;
            
            // Check if this day is today
            const today = new Date();
            const isToday = formatDateString(day.date) === formatDateString(today);
            
            return (
              <div
                key={index}
                className={`calendar-day ${!day.isCurrentMonth ? 'other-month' : ''} ${hasAttendance ? 'has-attendance' : ''} ${isToday ? 'today' : ''}`}
                onClick={() => handleDayClick(day)}
              >
                <div className="day-number">{day.date.getDate()}</div>
                {hasAttendance && (
                  <div className="attendance-indicators">
                    {attendanceCount[ServiceType.Daycare] && (
                      <div className="indicator daycare" title={`Daycare: ${attendanceCount[ServiceType.Daycare]}`}>
                        {attendanceCount[ServiceType.Daycare]}
                      </div>
                    )}
                    {attendanceCount[ServiceType.Training] && (
                      <div className="indicator training" title={`Training: ${attendanceCount[ServiceType.Training]}`}>
                        T{attendanceCount[ServiceType.Training]}
                      </div>
                    )}
                    {attendanceCount[ServiceType.Boarding] && (
                      <div className="indicator boarding" title={`Boarding: ${attendanceCount[ServiceType.Boarding]}`}>
                        B{attendanceCount[ServiceType.Boarding]}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showAttendanceModal && selectedDate && (
        <AttendanceModal
          date={selectedDate}
          dogs={dogs}
          attendance={attendance[formatDateString(selectedDate)] || {}}
          onClose={() => setShowAttendanceModal(false)}
          onUpdateAttendance={updateAttendance}
        />
      )}

      {showScheduleModal && (
        <ScheduleModal
          dogs={dogs}
          schedules={recurringSchedules}
          onClose={() => setShowScheduleModal(false)}
        />
      )}
    </div>
  );
}

interface AttendanceModalProps {
  date: Date;
  dogs: Dog[];
  attendance: Record<string, AttendanceEntry>;
  onClose: () => void;
  onUpdateAttendance: (
    dogId: string,
    serviceType: ServiceType,
    attending: boolean,
    dropOffTime?: string,
    pickUpTime?: string,
    notes?: string,
    skipHouseholdSync?: boolean
  ) => void;
}

function AttendanceModal({ date, dogs, attendance, onClose, onUpdateAttendance }: AttendanceModalProps) {
  const [selectedService, setSelectedService] = useState<ServiceType>(ServiceType.Daycare);
  const [formData, setFormData] = useState<Record<string, {
    attending: boolean;
    dropOffTime: string;
    pickUpTime: string;
    notes: string;
  }>>({});

  useEffect(() => {
    const initialData: typeof formData = {};
    dogs.forEach(dog => {
      const entryKey = `${dog.id}_${selectedService}`;
      const existing = attendance[entryKey];
      initialData[dog.id] = {
        attending: existing?.attending || false,
        dropOffTime: existing?.drop_off_time || '',
        pickUpTime: existing?.pick_up_time || '',
        notes: existing?.notes || '',
      };
    });
    setFormData(initialData);
  }, [dogs, attendance, selectedService]);

  const groupDogsByHousehold = (dogs: Dog[]) => {
    const households: Record<string, Dog[]> = {};
    const individualDogs: Dog[] = [];

    dogs.forEach(dog => {
      if (dog.household_id) {
        if (!households[dog.household_id]) {
          households[dog.household_id] = [];
        }
        households[dog.household_id].push(dog);
      } else {
        individualDogs.push(dog);
      }
    });

    return { households, individualDogs };
  };

  const selectHousehold = (householdId: string, attending: boolean) => {
    const householdDogs = dogs.filter(dog => dog.household_id === householdId);
    const updatedFormData = { ...formData };
    
    householdDogs.forEach(dog => {
      updatedFormData[dog.id] = {
        ...updatedFormData[dog.id],
        attending
      };
    });
    
    setFormData(updatedFormData);
  };

  const removeFromHousehold = (dogId: string) => {
    setFormData(prev => ({
      ...prev,
      [dogId]: { ...prev[dogId], attending: false }
    }));
  };

  const handleSubmit = () => {
    Object.entries(formData).forEach(([dogId, data]) => {
      onUpdateAttendance(
        dogId,
        selectedService,
        data.attending,
        data.dropOffTime || undefined,
        data.pickUpTime || undefined,
        data.notes || undefined,
        true // Skip household sync for individual dog selections
      );
    });
    onClose();
  };

  return (
    <div className="modal">
      <div className="modal-content large">
        <h3>Attendance for {date.toLocaleDateString()}</h3>
        
        <div className="service-tabs">
          {Object.values(ServiceType).map(service => (
            <button
              key={service}
              className={`tab ${selectedService === service ? 'active' : ''}`}
              onClick={() => setSelectedService(service)}
            >
              {service}
            </button>
          ))}
        </div>

        <div className="attendance-list">
          {/* Household Groups */}
          {Object.entries(groupDogsByHousehold(dogs).households).map(([householdId, householdDogs]) => (
            <div key={householdId} className="household-attendance-section">
              <div className="household-attendance-header">
                <h4>{householdDogs[0].owner}'s Household ({householdDogs.length} dogs)</h4>
                <div className="household-controls">
                  <button 
                    className="btn btn-success btn-sm" 
                    onClick={() => selectHousehold(householdId, true)}
                    title="Add entire household"
                  >
                    + Add All
                  </button>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => selectHousehold(householdId, false)}
                    title="Remove entire household"
                  >
                    - Remove All
                  </button>
                </div>
              </div>
              {householdDogs.map(dog => (
                <div key={dog.id} className="attendance-row">
                  <div className="dog-info">
                    <label>
                      <input
                        type="checkbox"
                        checked={formData[dog.id]?.attending || false}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          [dog.id]: { ...prev[dog.id], attending: e.target.checked }
                        }))}
                      />
                      <strong>
                        {dog.name}
                        {formData[dog.id]?.attending && (
                          <button
                            className="btn-icon btn-danger btn-xs"
                            onClick={() => removeFromHousehold(dog.id)}
                            title="Remove this dog from attendance"
                          >
                            ✗
                          </button>
                        )}
                      </strong> ({dog.owner})
                    </label>
                  </div>
                  {formData[dog.id]?.attending && (
                    <div className="attendance-details">
                      <input
                        type="time"
                        placeholder="Drop-off"
                        value={formData[dog.id]?.dropOffTime || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          [dog.id]: { ...prev[dog.id], dropOffTime: e.target.value }
                        }))}
                        className="input time-input"
                      />
                      <input
                        type="time"
                        placeholder="Pick-up"
                        value={formData[dog.id]?.pickUpTime || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          [dog.id]: { ...prev[dog.id], pickUpTime: e.target.value }
                        }))}
                        className="input time-input"
                      />
                      <input
                        type="text"
                        placeholder="Notes"
                        value={formData[dog.id]?.notes || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          [dog.id]: { ...prev[dog.id], notes: e.target.value }
                        }))}
                        className="input notes-input"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* Individual Dogs */}
          {groupDogsByHousehold(dogs).individualDogs.length > 0 && (
            <div className="household-attendance-section">
              <div className="household-attendance-header">
                <h4>Individual Dogs ({groupDogsByHousehold(dogs).individualDogs.length} dogs)</h4>
              </div>
              {groupDogsByHousehold(dogs).individualDogs.map(dog => (
                <div key={dog.id} className="attendance-row">
                  <div className="dog-info">
                    <label>
                      <input
                        type="checkbox"
                        checked={formData[dog.id]?.attending || false}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          [dog.id]: { ...prev[dog.id], attending: e.target.checked }
                        }))}
                      />
                      <strong>{dog.name}</strong> ({dog.owner})
                    </label>
                  </div>
                  {formData[dog.id]?.attending && (
                    <div className="attendance-details">
                      <input
                        type="time"
                        placeholder="Drop-off"
                        value={formData[dog.id]?.dropOffTime || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          [dog.id]: { ...prev[dog.id], dropOffTime: e.target.value }
                        }))}
                        className="input time-input"
                      />
                      <input
                        type="time"
                        placeholder="Pick-up"
                        value={formData[dog.id]?.pickUpTime || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          [dog.id]: { ...prev[dog.id], pickUpTime: e.target.value }
                        }))}
                        className="input time-input"
                      />
                      <input
                        type="text"
                        placeholder="Notes"
                        value={formData[dog.id]?.notes || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          [dog.id]: { ...prev[dog.id], notes: e.target.value }
                        }))}
                        className="input notes-input"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit}>
            Save Attendance
          </button>
        </div>
      </div>
    </div>
  );
}

interface ScheduleModalProps {
  dogs: Dog[];
  schedules: RecurringSchedule[];
  onClose: () => void;
}

function ScheduleModal({ dogs, schedules, onClose }: ScheduleModalProps) {

  const getDogName = (dogId: string) => {
    const dog = dogs.find(d => d.id === dogId);
    return dog ? dog.name : 'Unknown Dog';
  };

  const formatSchedulePattern = (pattern: any): string => {
    if (typeof pattern === 'string') {
      return pattern;
    }
    
    // Handle the Custom pattern with day numbers
    if (pattern && typeof pattern === 'object' && 'Custom' in pattern) {
      const dayNumbers = pattern.Custom as number[];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return dayNumbers.map(day => dayNames[day]).join(', ');
    }
    
    return 'Unknown pattern';
  };

  // Group schedules by dog
  const schedulesByDog = schedules.reduce((acc, schedule) => {
    if (!acc[schedule.dog_id]) {
      acc[schedule.dog_id] = [];
    }
    acc[schedule.dog_id].push(schedule);
    return acc;
  }, {} as Record<string, typeof schedules>);

  return (
    <div className="modal">
      <div className="modal-content large">
        <h3>Current Recurring Schedules</h3>
        
        <div className="info-message">
          <p>Recurring schedules are managed in Dog Management. Edit a dog to modify their schedule.</p>
        </div>
        
        <div className="existing-schedules">
          <div className="schedule-list">
            {Object.entries(schedulesByDog).map(([dogId, dogSchedules]) => (
              <div key={dogId} className="schedule-item">
                <div className="schedule-info">
                  <strong>{getDogName(dogId)}</strong>
                  <br />
                  <span className="schedule-pattern">
                    {dogSchedules.map(schedule => 
                      `${schedule.service_type} every ${formatSchedulePattern(schedule.pattern)}`
                    ).join(' • ')}
                  </span>
                  <br />
                  <span className="schedule-dates">
                    Started: {dogSchedules[0].start_date} {dogSchedules[0].end_date ? `• Ends: ${dogSchedules[0].end_date}` : '(ongoing)'}
                  </span>
                  {dogSchedules.some(s => s.drop_off_time || s.pick_up_time) && (
                    <>
                      <br />
                      <span className="schedule-times">
                        {dogSchedules.map(schedule => {
                          if (schedule.drop_off_time || schedule.pick_up_time) {
                            const times = [];
                            if (schedule.drop_off_time) times.push(`${schedule.service_type} drop-off: ${schedule.drop_off_time}`);
                            if (schedule.pick_up_time) times.push(`${schedule.service_type} pick-up: ${schedule.pick_up_time}`);
                            return times.join(' • ');
                          }
                          return '';
                        }).filter(Boolean).join(' • ')}
                      </span>
                    </>
                  )}
                </div>
                <div className="schedule-status">
                  {dogSchedules.every(s => s.active) ? (
                    <span className="status active">Active</span>
                  ) : (
                    <span className="status inactive">
                      {dogSchedules.some(s => s.active) ? 'Partial' : 'Inactive'}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {schedules.length === 0 && (
              <p className="empty-message">
                No recurring schedules set up yet.<br />
                Go to Dog Management and edit a dog to set up their weekly schedule.
              </p>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}