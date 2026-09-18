import type { CategoryModel } from '@/lib/models';
import { SHARK_WS_ID } from '@/lib/demo/store';

export function sharkCatalog(): CategoryModel[] {
  return [
    {
      id: 'shark-home', workspaceId: SHARK_WS_ID, name: 'Home', icon: 'layout', order: 0,
      subcategories: [
        { id: 'overview', categoryId: 'shark-home', name: 'Overview', icon: 'layout', group: 'General', route: '/shark-home/overview', order: 0 },
      ],
    },
    {
      id: 'master-house', workspaceId: SHARK_WS_ID, name: 'Master House', icon: 'chart', order: 1,
      subcategories: [
        { id: 'report-info', categoryId: 'master-house', name: 'Report Info', icon: 'scroll', group: 'Maritime Imports', route: '/master-house/report-info', order: 0 },
        { id: 'port', categoryId: 'master-house', name: 'Port', icon: 'db', group: 'Maritime Imports', route: '/master-house/port', order: 1 },
        { id: 'year-comparison', categoryId: 'master-house', name: 'Year Comparison', icon: 'chart', group: 'Maritime Imports', route: '/master-house/year-comparison', order: 2 },
        { id: 'consignee-details', categoryId: 'master-house', name: 'Consignee Details', icon: 'user', group: 'Maritime Imports', route: '/master-house/consignee-details', order: 3 },
        { id: 'consignees-by-port', categoryId: 'master-house', name: 'Consignees by Port', icon: 'users', group: 'Maritime Imports', route: '/master-house/consignees-by-port', order: 4 },
        { id: 'origin-port-detail', categoryId: 'master-house', name: 'Origin Port Detail', icon: 'pulse', group: 'Maritime Imports', route: '/master-house/origin-port-detail', order: 5 },
        { id: 'table-consignees-list', categoryId: 'master-house', name: 'Consignees List', icon: 'note', group: 'Maritime Imports', route: '/master-house/table-consignees-list', order: 6 },
      ],
    },
  ];
}