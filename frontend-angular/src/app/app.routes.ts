import { Routes } from '@angular/router';
import { DonorPageComponent } from './pages/donor-page/donor-page.component';
import { AdminPageComponent } from './pages/admin-page/admin-page.component';

export const routes: Routes = [
  {
    path: '',
    component: DonorPageComponent,
    title: 'Nepal Tragedy Relief Fund | Vidarbha Dhol Tasha Pathak'
  },
  {
    path: 'admin',
    component: AdminPageComponent,
    title: 'Admin Verification Portal | Vidarbha Dhol Tasha Pathak'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
