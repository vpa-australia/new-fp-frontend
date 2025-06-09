# New FP Frontend

A modern Next.js frontend application for managing shipments, warehouses, and orders.

## 🚀 Features

- **Shipment Management**: View, create, and manage shipments
- **Warehouse Integration**: Track stock status across multiple warehouses
- **Order Processing**: Handle order fulfillment and tracking
- **User Management**: Manage user roles and permissions
- **Real-time Updates**: Live status updates for shipments and stock

## 🛠️ Tech Stack

- **Framework**: Next.js 15.3.1
- **UI Components**: Radix UI
- **Styling**: TailwindCSS
- **State Management**: React Hooks
- **Icons**: Lucide React
- **Language**: TypeScript

## 📦 Prerequisites

- Node.js (Latest LTS version recommended)
- npm or yarn package manager

## 🔧 Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd new-fp-frontend
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Start the development server:
```bash
npm run dev
# or
yarn dev
```

## 🏗️ Project Structure

```
src/
├── app/                 # Next.js app directory
│   ├── dashboard/       # Dashboard pages
│   ├── login/          # Authentication pages
│   └── register/       # User registration
├── components/         # Reusable components
│   ├── ShipmentDetailView.tsx  # Shipment details component
│   ├── ShipmentsTable.tsx      # Shipments list component
│   └── ui/             # UI components
├── hooks/              # Custom React hooks
└── lib/               # Utility functions
```

## 🔑 Key Components

### ShipmentDetailView
- Displays detailed information about a shipment
- Manages stock status across warehouses
- Handles shipment updates and modifications

### ShipmentsTable
- Lists all shipments with filtering and sorting
- Provides quick actions for shipment management
- Integrates with warehouse and carrier systems

## 🔒 Authentication

The application uses token-based authentication. Store your authentication token in localStorage:
```typescript
localStorage.setItem('authToken', 'your-token-here')
```

## 🌐 API Integration

The frontend integrates with the following API endpoints:

- `https://ship-orders.vpa.com.au/api/platform/warehouses`
- `https://ship-orders.vpa.com.au/api/platform/carriers`
- `https://ship-orders.vpa.com.au/api/shipments`

## 📱 Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build production application
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 🎨 UI Components

The application uses Radix UI components for consistent and accessible UI elements:

- Dialog boxes for forms and confirmations
- Tooltips for additional information
- Toast notifications for user feedback
- Tabs for organized content display
- Radio groups and checkboxes for selections

## 🔄 State Management

The application uses React's built-in state management solutions:

- useState for local component state
- useEffect for side effects and data fetching
- Custom hooks for reusable state logic

## 🎯 Future Improvements

- Implement real-time updates using WebSocket
- Add comprehensive error boundary handling
- Enhance accessibility features
- Add end-to-end testing
- Implement performance monitoring

## 📄 License

This project is private and confidential. All rights reserved.
