import React, { useState } from 'react';
import { Plus, Edit, Trash2, Download, Upload, Search } from 'lucide-react';
import { Dog } from '../App';

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
  age: string;
  vaccine_date: string;
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
    age: '',
    vaccine_date: ''
  });

  const filteredDogs = dogs.filter(dog =>
    dog.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dog.owner.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dog.breed.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormData({
      name: '',
      owner: '',
      phone: '',
      email: '',
      breed: '',
      age: '',
      vaccine_date: ''
    });
    setEditingDog(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingDog) {
        await onUpdateDog({
          ...editingDog,
          ...formData,
          vaccine_date: formData.vaccine_date || undefined
        });
      } else {
        await onAddDog({
          ...formData,
          vaccine_date: formData.vaccine_date || undefined
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
      age: dog.age,
      vaccine_date: dog.vaccine_date || ''
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
                  <label>Age</label>
                  <input
                    type="text"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
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

      <div className="dogs-grid">
        {filteredDogs.map(dog => (
          <div key={dog.id} className="dog-card">
            <div className="dog-header">
              <h3>{dog.name}</h3>
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
              <p><strong>Age:</strong> {dog.age}</p>
              {dog.phone && <p><strong>Phone:</strong> {dog.phone}</p>}
              {dog.email && <p><strong>Email:</strong> {dog.email}</p>}
              {dog.vaccine_date && (
                <p><strong>Last Vaccine:</strong> {new Date(dog.vaccine_date).toLocaleDateString()}</p>
              )}
            </div>
          </div>
        ))}
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