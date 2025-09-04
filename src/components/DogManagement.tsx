import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Download, Upload, Search } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Dog, DogSchedule } from '../App';

interface DogManagementProps {
  dogs: Dog[];
  onAddDog: (dog: Omit<Dog, 'id' | 'created_at'>) => Promise<void>;
  onUpdateDog: (dog: Dog) => Promise<void>;
  onDeleteDog: (dogId: string) => Promise<void>;
  onExportData: () => Promise<void>;
  onImportData: (file: File) => Promise<void>;
}

interface DogFormData {
  name: string;
  owner: string;
  phone: string;
  email: string;
  breed: string;
  date_of_birth: string;
  vaccine_date: string;
  schedule: DogSchedule;
  household_id: string;
  create_household: boolean;
}

function DogAgeDisplay({ dateOfBirth }: { dateOfBirth?: string }) {
  const [age, setAge] = useState<string>('');

  useEffect(() => {
    if (dateOfBirth) {
      invoke<string>('calculate_age', { dateOfBirth })
        .then(setAge)
        .catch((error) => {
          console.error('Failed to calculate age:', error);
          setAge('Unknown');
        });
    } else {
      setAge('Not specified');
    }
  }, [dateOfBirth]);

  return <span>{age}</span>;
}

export default function DogManagement({ 
  dogs, 
  onAddDog, 
  onUpdateDog, 
  onDeleteDog,
  onExportData,
  onImportData
}: DogManagementProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingDog, setEditingDog] = useState<Dog | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<DogFormData>({
    name: '',
    owner: '',
    phone: '',
    email: '',
    breed: '',
    date_of_birth: '',
    vaccine_date: '',
    schedule: {
      daycare_days: [],
      training_days: [],
      boarding_days: [],
      daycare_drop_off: '',
      daycare_pick_up: '',
      training_drop_off: '',
      training_pick_up: '',
      start_date: '',
      end_date: '',
      active: true,
    },
    household_id: '',
    create_household: false,
  });

  const filteredDogs = dogs.filter(dog =>
    dog.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dog.owner.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dog.breed.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const { households, individualDogs } = groupDogsByHousehold(filteredDogs);

  const resetForm = () => {
    setFormData({
      name: '',
      owner: '',
      phone: '',
      email: '',
      breed: '',
      date_of_birth: '',
      vaccine_date: '',
      schedule: {
        daycare_days: [],
        training_days: [],
        boarding_days: [],
        daycare_drop_off: '',
        daycare_pick_up: '',
        training_drop_off: '',
        training_pick_up: '',
        start_date: '',
        end_date: '',
        active: true,
      },
      household_id: '',
      create_household: false,
    });
    setEditingDog(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let householdId = formData.household_id;
      
      // Generate new household ID if creating a new household
      if (formData.create_household) {
        householdId = crypto.randomUUID();
      }
      
      if (editingDog) {
        await onUpdateDog({
          ...editingDog,
          ...formData,
          vaccine_date: formData.vaccine_date || undefined,
          household_id: householdId || undefined
        });
      } else {
        await onAddDog({
          ...formData,
          vaccine_date: formData.vaccine_date || undefined,
          household_id: householdId || undefined
        });
      }
      resetForm();
    } catch (error) {
      alert('Failed to save dog. Please try again.');
    }
  };

  const handleEdit = (dog: Dog) => {
    setFormData({
      name: dog.name,
      owner: dog.owner,
      phone: dog.phone,
      email: dog.email,
      breed: dog.breed,
      date_of_birth: dog.date_of_birth || '',
      vaccine_date: dog.vaccine_date || '',
      schedule: dog.schedule || {
        daycare_days: [],
        training_days: [],
        boarding_days: [],
        daycare_drop_off: '',
        daycare_pick_up: '',
        training_drop_off: '',
        training_pick_up: '',
        start_date: '',
        end_date: '',
        active: true,
      },
      household_id: dog.household_id || '',
      create_household: false,
    });
    setEditingDog(dog);
    setShowForm(true);
  };

  const handleDelete = async (dog: Dog) => {
    if (window.confirm(`Are you sure you want to delete ${dog.name}? This action cannot be undone.`)) {
      try {
        await onDeleteDog(dog.id);
      } catch (error) {
        alert('Failed to delete dog. Please try again.');
      }
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await onImportData(file);
        alert('Data imported successfully!');
      } catch (error) {
        alert('Failed to import data. Please check the file format.');
      }
    }
    e.target.value = '';
  };

  return (
    <div className="dog-management">
      <div className="toolbar">
        <div className="search-container">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search dogs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input search-input"
          />
        </div>
        <div className="toolbar-buttons">
          <button 
            className="btn btn-primary"
            onClick={() => setShowForm(true)}
          >
            <Plus size={16} />
            Add Dog
          </button>
          <button 
            className="btn btn-secondary"
            onClick={onExportData}
          >
            <Download size={16} />
            Export
          </button>
          <label className="btn btn-secondary">
            <Upload size={16} />
            Import
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {showForm && (
        <div className="modal">
          <div className="modal-content">
            <h3>{editingDog ? 'Edit Dog' : 'Add New Dog'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Dog Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label>Owner Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.owner}
                    onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label>Breed</label>
                  <input
                    type="text"
                    value={formData.breed}
                    onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label>Last Vaccine Date</label>
                  <input
                    type="date"
                    value={formData.vaccine_date}
                    onChange={(e) => setFormData({ ...formData, vaccine_date: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              
              {/* Schedule Section */}
              <div className="schedule-section">
                <h4>Weekly Schedule</h4>
                <div className="schedule-active">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.schedule.active}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        schedule: { ...formData.schedule, active: e.target.checked } 
                      })}
                    />
                    Enable recurring schedule
                  </label>
                </div>
                
                {formData.schedule.active && (
                  <>
                    <div className="form-group">
                      <label>Schedule Start Date (optional)</label>
                      <input
                        type="date"
                        value={formData.schedule.start_date || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          schedule: { ...formData.schedule, start_date: e.target.value || undefined }
                        })}
                        className="input"
                        title="Leave empty to start immediately"
                      />
                      <small>Leave empty to start the schedule immediately</small>
                    </div>
                    <div className="form-group">
                      <label>Schedule End Date (optional)</label>
                      <input
                        type="date"
                        value={formData.schedule.end_date || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          schedule: { ...formData.schedule, end_date: e.target.value || undefined }
                        })}
                        className="input"
                        title="Leave empty for ongoing schedule"
                      />
                      <small>Leave empty for an ongoing schedule</small>
                    </div>
                  </>
                )}
                
                {formData.schedule.active && (
                  <>
                    {/* Daycare Schedule */}
                    <div className="service-schedule">
                      <h5>Daycare Days</h5>
                      <div className="day-selector">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                          <label key={day} className="day-checkbox">
                            <input
                              type="checkbox"
                              checked={formData.schedule.daycare_days.includes(index)}
                              onChange={(e) => {
                                const days = [...formData.schedule.daycare_days];
                                if (e.target.checked) {
                                  days.push(index);
                                } else {
                                  const dayIndex = days.indexOf(index);
                                  if (dayIndex > -1) days.splice(dayIndex, 1);
                                }
                                setFormData({
                                  ...formData,
                                  schedule: { ...formData.schedule, daycare_days: days.sort() }
                                });
                              }}
                            />
                            {day}
                          </label>
                        ))}
                      </div>
                      <div className="time-fields">
                        <input
                          type="time"
                          placeholder="Drop-off time"
                          value={formData.schedule.daycare_drop_off || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            schedule: { ...formData.schedule, daycare_drop_off: e.target.value }
                          })}
                          className="input time-input"
                        />
                        <input
                          type="time"
                          placeholder="Pick-up time"
                          value={formData.schedule.daycare_pick_up || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            schedule: { ...formData.schedule, daycare_pick_up: e.target.value }
                          })}
                          className="input time-input"
                        />
                      </div>
                    </div>

                    {/* Training Schedule */}
                    <div className="service-schedule">
                      <h5>Training Days</h5>
                      <div className="day-selector">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                          <label key={day} className="day-checkbox">
                            <input
                              type="checkbox"
                              checked={formData.schedule.training_days.includes(index)}
                              onChange={(e) => {
                                const days = [...formData.schedule.training_days];
                                if (e.target.checked) {
                                  days.push(index);
                                } else {
                                  const dayIndex = days.indexOf(index);
                                  if (dayIndex > -1) days.splice(dayIndex, 1);
                                }
                                setFormData({
                                  ...formData,
                                  schedule: { ...formData.schedule, training_days: days.sort() }
                                });
                              }}
                            />
                            {day}
                          </label>
                        ))}
                      </div>
                      <div className="time-fields">
                        <input
                          type="time"
                          placeholder="Session start"
                          value={formData.schedule.training_drop_off || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            schedule: { ...formData.schedule, training_drop_off: e.target.value }
                          })}
                          className="input time-input"
                        />
                        <input
                          type="time"
                          placeholder="Session end"
                          value={formData.schedule.training_pick_up || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            schedule: { ...formData.schedule, training_pick_up: e.target.value }
                          })}
                          className="input time-input"
                        />
                      </div>
                    </div>

                    {/* Boarding Schedule */}
                    <div className="service-schedule">
                      <h5>Boarding Days</h5>
                      <div className="day-selector">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                          <label key={day} className="day-checkbox">
                            <input
                              type="checkbox"
                              checked={formData.schedule.boarding_days.includes(index)}
                              onChange={(e) => {
                                const days = [...formData.schedule.boarding_days];
                                if (e.target.checked) {
                                  days.push(index);
                                } else {
                                  const dayIndex = days.indexOf(index);
                                  if (dayIndex > -1) days.splice(dayIndex, 1);
                                }
                                setFormData({
                                  ...formData,
                                  schedule: { ...formData.schedule, boarding_days: days.sort() }
                                });
                              }}
                            />
                            {day}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              {/* Household Section */}
              <div className="household-section">
                <h4>Household</h4>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.create_household}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        create_household: e.target.checked,
                        household_id: e.target.checked ? '' : formData.household_id
                      })}
                    />
                    Create new household for this dog
                  </label>
                </div>
                {!formData.create_household && (
                  <div className="form-group">
                    <label>Join existing household (optional)</label>
                    <select
                      value={formData.household_id}
                      onChange={(e) => setFormData({ ...formData, household_id: e.target.value })}
                      className="input"
                    >
                      <option value="">No household</option>
                      {Array.from(new Set(dogs.filter(d => d.household_id).map(d => d.household_id))).map(householdId => {
                        const householdDogs = dogs.filter(d => d.household_id === householdId);
                        const householdName = householdDogs.map(d => d.name).join(', ');
                        return (
                          <option key={householdId} value={householdId}>
                            {householdName} ({householdDogs.length} dogs)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>
              
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingDog ? 'Update' : 'Add'} Dog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="dogs-container">
        {/* Household Groups */}
        {Object.entries(households).map(([householdId, householdDogs]) => (
          <div key={householdId} className="household-group">
            <div className="household-header">
              <h3>
                {householdDogs[0].owner}'s Household ({householdDogs.length} dog{householdDogs.length > 1 ? 's' : ''})
              </h3>
            </div>
            <div className="dogs-grid">
              {householdDogs.map(dog => (
                <div key={dog.id} className="dog-card">
                  <div className="dog-header">
                    <h4>{dog.name}</h4>
                    <div className="dog-actions">
                      <button 
                        className="btn-icon"
                        onClick={() => handleEdit(dog)}
                        title="Edit dog"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        className="btn-icon btn-danger"
                        onClick={() => handleDelete(dog)}
                        title="Delete dog"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="dog-info">
                    <p><strong>Owner:</strong> {dog.owner}</p>
                    <p><strong>Breed:</strong> {dog.breed}</p>
                    <p><strong>Age:</strong> <DogAgeDisplay key={dog.date_of_birth} dateOfBirth={dog.date_of_birth} /></p>
                    {dog.phone && <p><strong>Phone:</strong> {dog.phone}</p>}
                    {dog.email && <p><strong>Email:</strong> {dog.email}</p>}
                    {dog.vaccine_date && (
                      <p><strong>Last Vaccine:</strong> {new Date(dog.vaccine_date).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Individual Dogs */}
        {individualDogs.length > 0 && (
          <div className="household-group">
            <div className="household-header">
              <h3>Individual Dogs ({individualDogs.length} dog{individualDogs.length > 1 ? 's' : ''})</h3>
            </div>
            <div className="dogs-grid">
              {individualDogs.map(dog => (
                <div key={dog.id} className="dog-card">
                  <div className="dog-header">
                    <h4>{dog.name}</h4>
                    <div className="dog-actions">
                      <button 
                        className="btn-icon"
                        onClick={() => handleEdit(dog)}
                        title="Edit dog"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        className="btn-icon btn-danger"
                        onClick={() => handleDelete(dog)}
                        title="Delete dog"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="dog-info">
                    <p><strong>Owner:</strong> {dog.owner}</p>
                    <p><strong>Breed:</strong> {dog.breed}</p>
                    <p><strong>Age:</strong> <DogAgeDisplay key={dog.date_of_birth} dateOfBirth={dog.date_of_birth} /></p>
                    {dog.phone && <p><strong>Phone:</strong> {dog.phone}</p>}
                    {dog.email && <p><strong>Email:</strong> {dog.email}</p>}
                    {dog.vaccine_date && (
                      <p><strong>Last Vaccine:</strong> {new Date(dog.vaccine_date).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {filteredDogs.length === 0 && (
        <div className="empty-state">
          <p>
            {searchTerm 
              ? `No dogs found matching "${searchTerm}"`
              : 'No dogs registered yet. Add your first dog to get started!'
            }
          </p>
        </div>
      )}
    </div>
  );
}