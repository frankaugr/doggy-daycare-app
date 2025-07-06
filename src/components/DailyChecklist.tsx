import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Calendar, Users, Thermometer } from 'lucide-react';
import { format } from 'date-fns';
import { Dog, DayData, DailyRecord } from '../App';

interface DailyChecklistProps {
  dogs: Dog[];
}

const checklistItems = [
  'Medication given',
  'Bathroom break',
  'Exercise/Play time', 
  'Behavior normal',
  'Social interaction',
  'Water available'
];

export default function DailyChecklist({ dogs }: DailyChecklistProps) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [amTemp, setAmTemp] = useState('');
  const [pmTemp, setPmTemp] = useState('');

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

  const updateAttendance = async (dogId: string, attending: boolean) => {
    try {
      await invoke('update_attendance', { date: selectedDate, dogId, attending });
      loadDayData();
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

  const selectAllDogs = () => {
    dogs.forEach(dog => updateAttendance(dog.id, true));
  };

  const clearAllDogs = () => {
    dogs.forEach(dog => updateAttendance(dog.id, false));
  };

  const attendingDogs = dogs.filter(dog => dayData?.attendance.dogs[dog.id]);

  return (
    <div className="daily-checklist">
      <div className="card">
        <div className="card-header">
          <Users size={20} />
          <h3>Dogs Attending Today</h3>
        </div>
        <div className="attendance-controls">
          <button className="btn btn-success" onClick={selectAllDogs}>
            Select All
          </button>
          <button className="btn btn-secondary" onClick={clearAllDogs}>
            Clear All
          </button>
        </div>
        <div className="attendance-grid">
          {dogs.map(dog => (
            <label key={dog.id} className="attendance-item">
              <input
                type="checkbox"
                checked={dayData?.attendance.dogs[dog.id] || false}
                onChange={(e) => updateAttendance(dog.id, e.target.checked)}
              />
              <span>{dog.name}</span>
            </label>
          ))}
        </div>
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
            placeholder="°F"
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
            placeholder="°F"
            className="input temp-input"
          />
        </label>
      </div>

      <div className="daily-dogs">
        {attendingDogs.length === 0 ? (
          <div className="empty-state">
            <p>No dogs selected for attendance today. Please select which dogs are attending above.</p>
          </div>
        ) : (
          attendingDogs.map(dog => {
            const record = dayData?.records[dog.id] || {};
            
            return (
              <div key={dog.id} className="dog-card">
                <h3>{dog.name}</h3>
                <div className="checklist">
                  {checklistItems.map(item => (
                    <div key={item} className="checklist-item">
                      <label>{item}:</label>
                      <div className="checklist-buttons">
                        <button
                          className={`check-btn ${record.checklist?.[item] === true ? 'active-good' : ''}`}
                          onClick={() => updateChecklist(dog.id, item, true)}
                        >
                          ✓
                        </button>
                        <button
                          className={`check-btn ${record.checklist?.[item] === false ? 'active-bad' : ''}`}
                          onClick={() => updateChecklist(dog.id, item, false)}
                        >
                          ✗
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="dog-times">
                  <div className="form-group">
                    <label>Feeding Times</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g., 9am, 2pm"
                      value={record.feeding_times || ''}
                      onChange={(e) => updateDailyRecord(dog.id, 'feeding_times', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Drop-off Time</label>
                    <input
                      type="time"
                      className="input"
                      value={record.drop_off_time || ''}
                      onChange={(e) => updateDailyRecord(dog.id, 'drop_off_time', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Pick-up Time</label>
                    <input
                      type="time"
                      className="input"
                      value={record.pick_up_time || ''}
                      onChange={(e) => updateDailyRecord(dog.id, 'pick_up_time', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Notes/Comments</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder={`Add any notes about ${dog.name}'s day...`}
                    value={record.notes || ''}
                    onChange={(e) => updateDailyRecord(dog.id, 'notes', e.target.value)}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}