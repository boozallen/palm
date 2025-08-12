import SettingsProvider, { useSettings } from './SettingsProvider';
import { renderWrapper } from '@/test/test-utils';

const FirstChildComponent = () => {
  const settings = useSettings();
  return (
    <div data-settings={settings}>
      One
    </div>
  );
};

const SecondChildComponent = () => {
  const settings = useSettings();
  return (
    <div data-settings={settings}>
      Two
    </div>
  );
};

describe('SettingsProvider', () => {
  it('provides expected SettingsProvider to child components', () => {
    const { getByText } = renderWrapper(
      <SettingsProvider>
        <FirstChildComponent/>
        <SecondChildComponent/>
      </SettingsProvider>
    );
    const firstChild = getByText('One');
    const secondChild = getByText('Two');
    const firstChildSettings = firstChild.getAttribute('data-settings');
    const secondChildSettings = secondChild.getAttribute('data-settings');
    expect(firstChildSettings).toBe(secondChildSettings);
  });
});

