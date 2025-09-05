import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Calendar, Users, Thermometer } from 'lucide-react';
import { format } from 'date-fns';
import { Dog, DayData, DailyRecord, ServiceType, AttendanceType, AttendanceEntry } from '../App';

interface DailyChecklistProps {
  dogs: Dog[];
}

const checklistCategories = {
  examination: [
    'Eyes',
    'Ears',
    'Nose',
    'Mouth',
    'Limbs',
    'Paws',
    'Fur/skin',
    'Bottom'
  ],
  behavior: [
    'Behaviour',
    'Rest',
    'Pooping',
    'Peeing',
    'Grooming',
    'Play',
    'Human Interaction',
    'Water Intake'
  ]
};

const getAllChecklistItems = () => [
  ...checklistCategories.examination,
  ...checklistCategories.behavior
];

export default function DailyChecklist({ dogs }: DailyChecklistProps) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [attendanceEntries, setAttendanceEntries] = useState<Record<string, AttendanceEntry>>({});
  const [amTemp, setAmTemp] = useState('');
  const [pmTemp, setPmTemp] = useState('');
  const [globalDropOffTime, setGlobalDropOffTime] = useState('');
  const [globalPickUpTime, setGlobalPickUpTime] = useState('');

  useEffect(() => {
    loadDayData();
  }, [selectedDate]);

  useEffect(() => {
    if (dayData) {
      setAmTemp(dayData.am_temp || '');
      setPmTemp(dayData.pm_temp || '');
    }
  }, [dayData]);

  const loadDayData = async () => {
    try {
      // Load unified attendance data (same source as Calendar)
      const attendanceResult = await invoke<Record<string, AttendanceEntry>>('get_attendance_for_date', { date: selectedDate });
      setAttendanceEntries(attendanceResult || {});
      
      // Still load day data for temperature, records, etc.
      const result = await invoke<DayData | null>('get_daily_data', { date: selectedDate });
      setDayData(result || {
        attendance: { dogs: {} },
        records: {},
        am_temp: '',
        pm_temp: ''
      });
    } catch (error) {
      console.error('Failed to load day data:', error);
    }
  };

  const getAttendanceType = (dogId: string): AttendanceType => {
    // Check unified attendance data first (primary source)
    const entryKey = `${dogId}_Daycare`;
    const attendanceEntry = attendanceEntries[entryKey];
    
    if (attendanceEntry?.attending) {
      // Check for half-day indicator in notes
      if (attendanceEntry.notes?.includes('Half-day')) {
        return AttendanceType.HalfDay;
      }
      return AttendanceType.FullDay;
    }
    
    // Fall back to legacy format if unified data doesn't exist
    if (dayData?.attendance.types?.[dogId]) {
      return dayData.attendance.types[dogId];
    }
    
    if (dayData?.attendance.dogs[dogId]) {
      return AttendanceType.FullDay;
    }
    
    return AttendanceType.NotAttending;
  };

  const updateAttendanceType = async (dogId: string, attendanceType: AttendanceType, skipHouseholdSync = false) => {
    try {
      // Convert to boolean for legacy compatibility
      const attending = attendanceType !== AttendanceType.NotAttending;
      
      // Find the dog and get their household
      const dog = dogs.find(d => d.id === dogId);
      const dogsToUpdate = skipHouseholdSync || !dog?.household_id 
        ? [dog].filter(Boolean)
        : dogs.filter(d => d.household_id === dog.household_id);
      
      // Update attendance for all dogs in the household (or just individual dog if skipHouseholdSync)
      for (const targetDog of dogsToUpdate) {
        if (!targetDog) continue;
        // Update both legacy and new attendance systems
        await invoke('update_attendance', { date: selectedDate, dogId: targetDog.id, attending });
        
        // Also update detailed attendance for daycare service to sync with calendar
        await invoke('update_detailed_attendance', {
          date: selectedDate,
          dogId: targetDog.id,
          serviceType: ServiceType.Daycare,
          attending,
          dropOffTime: null,
          pickUpTime: null,
          notes: attending ? `${attendanceType === AttendanceType.HalfDay ? 'Half-day' : 'Full-day'} attendance from daily checklist${dogsToUpdate.length > 1 ? ` (household sync)` : ''}` : null,
        });
        
        // Update new attendance type format
        await invoke('update_attendance_type', { 
          date: selectedDate, 
          dogId: targetDog.id, 
          attendanceType 
        });
      }
      
      loadDayData();
      // Reload unified attendance data
      const attendanceResult = await invoke<Record<string, AttendanceEntry>>('get_attendance_for_date', { date: selectedDate });
      setAttendanceEntries(attendanceResult || {});
    } catch (error) {
      console.error('Failed to update attendance:', error);
    }
  };


  const updateDailyRecord = async (dogId: string, field: keyof DailyRecord, value: any) => {
    if (!dayData) return;

    const currentRecord = dayData.records[dogId] || {};
    const updatedRecord = { ...currentRecord, [field]: value };

    try {
      await invoke('update_daily_record', { 
        date: selectedDate, 
        dogId, 
        record: updatedRecord 
      });
      loadDayData();
    } catch (error) {
      console.error('Failed to update daily record:', error);
    }
  };

  const updateChecklist = async (dogId: string, item: string, value: boolean) => {
    if (!dayData) return;

    const currentRecord = dayData.records[dogId] || {};
    const currentChecklist = currentRecord.checklist || {};
    const updatedChecklist = { ...currentChecklist, [item]: value };

    updateDailyRecord(dogId, 'checklist', updatedChecklist);
  };

  const checkAllItems = (dogId: string) => {
    if (!dayData) return;

    const allCheckedList = getAllChecklistItems().reduce((acc, item) => {
      acc[item] = true;
      return acc;
    }, {} as Record<string, boolean>);

    updateDailyRecord(dogId, 'checklist', allCheckedList);
  };

  const checkAllDogsAllItems = () => {
    attendingDogs.forEach(dog => checkAllItems(dog.id));
  };

  const updateTemperature = async () => {
    try {
      await invoke('update_temperature', { 
        date: selectedDate, 
        amTemp: amTemp || null, 
        pmTemp: pmTemp || null 
      });
    } catch (error) {
      console.error('Failed to update temperature:', error);
    }
  };

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

  const selectAllDogs = () => {
    dogs.forEach(dog => updateAttendanceType(dog.id, AttendanceType.FullDay));
  };

  const selectAllHalfDay = () => {
    dogs.forEach(dog => updateAttendanceType(dog.id, AttendanceType.HalfDay));
  };

  const clearAllDogs = () => {
    dogs.forEach(dog => updateAttendanceType(dog.id, AttendanceType.NotAttending));
  };

  const selectHousehold = (householdId: string, attendanceType: AttendanceType) => {
    const householdDogs = dogs.filter(dog => dog.household_id === householdId);
    householdDogs.forEach(dog => updateAttendanceType(dog.id, attendanceType));
  };

  const removeFromHousehold = async (dogId: string, householdId: string) => {
    const householdDogs = dogs.filter(dog => dog.household_id === householdId);
    const targetDog = householdDogs.find(dog => dog.id === dogId);
    
    if (targetDog && getAttendanceType(dogId) !== AttendanceType.NotAttending) {
      await updateAttendanceType(dogId, AttendanceType.NotAttending, true); // Skip household sync
    }
  };

  const applyGlobalTimes = async () => {
    for (const dog of attendingDogs) {
      const currentRecord = dayData?.records[dog.id] || {};
      const updatedRecord = { ...currentRecord };
      
      // Only apply global times if individual dog doesn't have times set
      if (globalDropOffTime && !currentRecord.drop_off_time) {
        updatedRecord.drop_off_time = globalDropOffTime;
      }
      if (globalPickUpTime && !currentRecord.pick_up_time) {
        updatedRecord.pick_up_time = globalPickUpTime;
      }
      
      // Update the record if there were changes
      if (updatedRecord.drop_off_time !== currentRecord.drop_off_time || 
          updatedRecord.pick_up_time !== currentRecord.pick_up_time) {
        try {
          await invoke('update_daily_record', { 
            date: selectedDate, 
            dogId: dog.id, 
            record: updatedRecord 
          });
        } catch (error) {
          console.error('Failed to update daily record:', error);
        }
      }
    }
    // Reload data to reflect changes
    loadDayData();
  };

  const attendingDogs = dogs
    .filter(dog => getAttendanceType(dog.id) !== AttendanceType.NotAttending)
    .sort((a, b) => a.name.localeCompare(b.name));

  const { households, individualDogs } = groupDogsByHousehold(dogs);

  return (
    <div className="daily-checklist">
      <div className="card">
        <div className="card-header">
          <Users size={20} />
          <h3>Dogs Attending Today</h3>
        </div>
        <div className="attendance-controls">
          <button className="btn btn-success" onClick={selectAllDogs}>
            All Full Day
          </button>
          <button className="btn btn-warning" onClick={selectAllHalfDay}>
            All Half Day
          </button>
          <button className="btn btn-secondary" onClick={clearAllDogs}>
            Clear All
          </button>
        </div>

        {/* Household Groups */}
        {Object.entries(households).map(([householdId, householdDogs]) => (
          <div key={householdId} className="household-attendance-group">
            <div className="household-attendance-header">
              <h4>{householdDogs[0].owner}'s Household ({householdDogs.length} dogs)</h4>
              <div className="household-controls">
                <button 
                  className="btn btn-success btn-sm" 
                  onClick={() => selectHousehold(householdId, AttendanceType.FullDay)}
                  title="Add entire household - full day"
                >
                  + Full Day
                </button>
                <button 
                  className="btn btn-warning btn-sm" 
                  onClick={() => selectHousehold(householdId, AttendanceType.HalfDay)}
                  title="Add entire household - half day"
                >
                  + Half Day
                </button>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => selectHousehold(householdId, AttendanceType.NotAttending)}
                  title="Remove entire household"
                >
                  - Remove All
                </button>
              </div>
            </div>
            <div className="attendance-grid">
              {householdDogs.sort((a, b) => a.name.localeCompare(b.name)).map(dog => {
                const attendanceType = getAttendanceType(dog.id);
                return (
                  <div key={dog.id} className="attendance-item">
                    <div className="dog-name-container">
                      <span className="dog-name">{dog.name}</span>
                      {attendanceType !== AttendanceType.NotAttending && (
                        <button
                          className="btn-icon btn-danger btn-xs"
                          onClick={() => removeFromHousehold(dog.id, householdId)}
                          title="Remove this dog from household attendance"
                        >
                          ✗
                        </button>
                      )}
                    </div>
                    <select
                      value={attendanceType}
                      onChange={(e) => updateAttendanceType(dog.id, e.target.value as AttendanceType, true)}
                      className="input attendance-select"
                    >
                      <option value={AttendanceType.NotAttending}>Not Attending</option>
                      <option value={AttendanceType.HalfDay}>Half Day</option>
                      <option value={AttendanceType.FullDay}>Full Day</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Individual Dogs */}
        {individualDogs.length > 0 && (
          <div className="household-attendance-group">
            <div className="household-attendance-header">
              <h4>Individual Dogs ({individualDogs.length} dogs)</h4>
            </div>
            <div className="attendance-grid">
              {individualDogs.sort((a, b) => a.name.localeCompare(b.name)).map(dog => {
                const attendanceType = getAttendanceType(dog.id);
                return (
                  <div key={dog.id} className="attendance-item">
                    <div className="dog-name-container">
                      <span className="dog-name">{dog.name}</span>
                    </div>
                    <select
                      value={attendanceType}
                      onChange={(e) => updateAttendanceType(dog.id, e.target.value as AttendanceType, true)}
                      className="input attendance-select"
                    >
                      <option value={AttendanceType.NotAttending}>Not Attending</option>
                      <option value={AttendanceType.HalfDay}>Half Day</option>
                      <option value={AttendanceType.FullDay}>Full Day</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="toolbar">
        <label className="toolbar-item">
          <Calendar size={16} />
          Date:
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input"
          />
        </label>
        <label className="toolbar-item">
          <Thermometer size={16} />
          AM Temp:
          <input
            type="text"
            value={amTemp}
            onChange={(e) => setAmTemp(e.target.value)}
            onBlur={updateTemperature}
            placeholder="°C"
            className="input temp-input"
          />
        </label>
        <label className="toolbar-item">
          <Thermometer size={16} />
          PM Temp:
          <input
            type="text"
            value={pmTemp}
            onChange={(e) => setPmTemp(e.target.value)}
            onBlur={updateTemperature}
            placeholder="°C"
            className="input temp-input"
          />
        </label>
        {attendingDogs.length > 0 && (
          <button
            className="btn btn-success"
            onClick={checkAllDogsAllItems}
          >
            Check All Items
          </button>
        )}
        <label className="toolbar-item">
          Global Drop-off:
          <input
            type="time"
            value={globalDropOffTime}
            onChange={(e) => setGlobalDropOffTime(e.target.value)}
            placeholder="Drop-off time"
            className="input time-input"
          />
        </label>
        <label className="toolbar-item">
          Global Pick-up:
          <input
            type="time"
            value={globalPickUpTime}
            onChange={(e) => setGlobalPickUpTime(e.target.value)}
            placeholder="Pick-up time"
            className="input time-input"
          />
        </label>
        {attendingDogs.length > 0 && (globalDropOffTime || globalPickUpTime) && (
          <button
            className="btn btn-primary"
            onClick={() => applyGlobalTimes()}
          >
            Apply Global Times
          </button>
        )}
      </div>

      <div className="daily-dogs">
        {attendingDogs.length === 0 ? (
          <div className="empty-state">
            <p>No dogs selected for attendance today. Please select which dogs are attending above.</p>
          </div>
        ) : (
          attendingDogs.map(dog => {
            const record = dayData?.records[dog.id] || {};
            const entryKey = `${dog.id}_Daycare`;
            const attendanceEntry = attendanceEntries[entryKey];
            
            // Use unified attendance data for times when available, fall back to legacy records
            const dropOffTime = attendanceEntry?.drop_off_time || record.drop_off_time || '';
            const pickUpTime = attendanceEntry?.pick_up_time || record.pick_up_time || '';
            
            return (
              <div key={dog.id} className="dog-card">
                <div className="dog-header">
                  <h3>
                    {dog.name}
                    {dog.household_id && (
                      <span className="household-indicator" title={`Household with ${dogs.filter(d => d.household_id === dog.household_id && d.id !== dog.id).map(d => d.name).join(', ')}`}>
                        🏠
                      </span>
                    )}
                  </h3>
                </div>
                <div className="dog-content">
                  <div className="checklist-row">
                    <div className="checklist-category">
                      <strong>Examination:</strong>
                      <div className="checklist-items-inline">
                        {checklistCategories.examination.map(item => (
                          <div key={item} className="checklist-item-inline">
                            <span className="item-label">{item}</span>
                            <button
                              className={`check-btn-xs ${record.checklist?.[item] === true ? 'active-good' : ''}`}
                              onClick={() => updateChecklist(dog.id, item, true)}
                            >
                              ✓
                            </button>
                            <button
                              className={`check-btn-xs ${record.checklist?.[item] === false ? 'active-bad' : ''}`}
                              onClick={() => updateChecklist(dog.id, item, false)}
                            >
                              ✗
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="checklist-category">
                      <strong>Behavior:</strong>
                      <div className="checklist-items-inline">
                        {checklistCategories.behavior.map(item => (
                          <div key={item} className="checklist-item-inline">
                            <span className="item-label">{item}</span>
                            <button
                              className={`check-btn-xs ${record.checklist?.[item] === true ? 'active-good' : ''}`}
                              onClick={() => updateChecklist(dog.id, item, true)}
                            >
                              ✓
                            </button>
                            <button
                              className={`check-btn-xs ${record.checklist?.[item] === false ? 'active-bad' : ''}`}
                              onClick={() => updateChecklist(dog.id, item, false)}
                            >
                              ✗
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="dog-details">
                    <div className="times-row">
                      <div className="form-group-compact">
                        <label>Feeding</label>
                        <input
                          type="text"
                          className="input input-sm"
                          placeholder="9am, 2pm"
                          value={record.feeding_times || ''}
                          onChange={(e) => updateDailyRecord(dog.id, 'feeding_times', e.target.value)}
                        />
                      </div>
                      <div className="form-group-compact">
                        <label>
                          Drop-off
                          {!dropOffTime && globalDropOffTime && (
                            <span className="global-time-indicator" title="Global time will be used">
                              (Global: {globalDropOffTime})
                            </span>
                          )}
                        </label>
                        <input
                          type="time"
                          className="input input-sm"
                          value={dropOffTime}
                          onChange={(e) => updateDailyRecord(dog.id, 'drop_off_time', e.target.value)}
                        />
                      </div>
                      <div className="form-group-compact">
                        <label>
                          Pick-up
                          {!pickUpTime && globalPickUpTime && (
                            <span className="global-time-indicator" title="Global time will be used">
                              (Global: {globalPickUpTime})
                            </span>
                          )}
                        </label>
                        <input
                          type="time"
                          className="input input-sm"
                          value={pickUpTime}
                          onChange={(e) => updateDailyRecord(dog.id, 'pick_up_time', e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div className="form-group-compact">
                      <label>Notes</label>
                      <textarea
                        className="input input-sm"
                        rows={2}
                        placeholder={`Notes about ${dog.name}'s day...`}
                        value={record.notes || ''}
                        onChange={(e) => updateDailyRecord(dog.id, 'notes', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}