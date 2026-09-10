import type {Meta, StoryObj} from '@storybook/react-vite';
import WorldCompositionLab from './WorldCompositionLab';

const meta = {
  title: 'REKT World Composition Lab',
  component: WorldCompositionLab,
  parameters: {layout: 'fullscreen'},
  globals: {a11y: {manual: true}},
} satisfies Meta<typeof WorldCompositionLab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TapeNormal: Story = {args: {variant: 'tape', scenario: 'normal'}};
export const DispatchNormal: Story = {args: {variant: 'dispatch', scenario: 'normal'}};
export const ReceiverNormal: Story = {args: {variant: 'receiver', scenario: 'normal'}};
export const TapeHelpNow: Story = {args: {variant: 'tape', scenario: 'help-now'}};
export const DispatchHelpNow: Story = {args: {variant: 'dispatch', scenario: 'help-now'}};
export const ReceiverHelpNow: Story = {args: {variant: 'receiver', scenario: 'help-now'}};
export const TapeQuiet: Story = {args: {variant: 'tape', scenario: 'quiet'}};
export const DispatchQuiet: Story = {args: {variant: 'dispatch', scenario: 'quiet'}};
export const ReceiverQuiet: Story = {args: {variant: 'receiver', scenario: 'quiet'}};
export const TapeBurst: Story = {args: {variant: 'tape', scenario: 'burst'}};
export const DispatchBurst: Story = {args: {variant: 'dispatch', scenario: 'burst'}};
export const ReceiverBurst: Story = {args: {variant: 'receiver', scenario: 'burst'}};
