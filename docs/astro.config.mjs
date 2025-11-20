// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const SITE_URL = 'https://hub.oscar.grycap.net';

// https://astro.build/config
export default defineConfig({
	site: SITE_URL,
	base: '/guide',
	integrations: [
		starlight({
			title: 'OSCAR Hub Guide',
			description: 'Contribution workflow and RO-Crate reference for the OSCAR Hub catalog.',
			social: [
				{
					icon: 'github',
					label: 'OSCAR Hub on GitHub',
					href: 'https://github.com/grycap/oscar-hub',
				},
			],
			sidebar: [
				{
					label: 'Overview',
					items: [{ label: 'OSCAR Hub Guide', slug: 'index' }],
				},
				{
					label: 'Contribution Guide',
					items: [
						{ label: 'Prerequisites & Setup', slug: 'contribute' },
						{ label: 'Workflow & Reviews', slug: 'contribute/workflow' },
						{ label: 'Adding & Maintaining Crates', slug: 'contribute/crates' },
					],
				},
				{
					label: 'RO-Crate Reference',
					items: [
						{ label: 'RO-Crate overview', slug: 'ro-crate' },
						{ label: 'Dataset & metadata sections', slug: 'ro-crate/sections' },
						{ label: 'Field reference & validation', slug: 'ro-crate/fields' },
					],
				},
			],
			tableOfContents: {
				minHeadingLevel: 2,
				maxHeadingLevel: 4,
			},
		}),
	],
});
