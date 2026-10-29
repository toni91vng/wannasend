import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { Body, Card, H3, InfoBox, Muted, Row, Screen, Small } from '@/components/ui';
import { useAppConfig } from '@/data/hooks';
import { colors } from '@/lib/theme';

/**
 * Lista de objetos prohibidos (decidida el 29/10/2026). Cada envío guarda la versión aceptada por el sender
 * (app_config.prohibited_list_version). Si cambia el contenido, hay que cambiar también esa versión.
 */
const PROHIBIDOS: { title: string; text?: string }[] = [
  { title: 'Dinero, tarjetas y títulos de valor', text: 'Salvo objetos personales del sender o del destinatario (por ejemplo, una cartera olvidada), con un máximo de 50 € en efectivo.' },
  { title: 'Joyas, metales preciosos y objetos de más de 300 €' },
  { title: 'Drogas y sustancias ilegales' },
  { title: 'Medicamentos que necesitan receta' },
  { title: 'Armas, munición, réplicas, explosivos y pirotecnia' },
  { title: 'Materiales peligrosos', text: 'Inflamables, gases, productos químicos o corrosivos y baterías de litio sueltas.' },
  { title: 'Animales vivos y restos humanos o de animales' },
  { title: 'Productos falsificados, robados o de contrabando' },
  { title: 'Documentos de identidad de otras personas', text: 'Los del propio sender o del destinatario sí se permiten.' },
  { title: 'Nada en cantidades para vender', text: 'Tabaco, alcohol, comida o cualquier producto en cantidades comerciales.' },
];

export default function Prohibidos() {
  const { data: cfg } = useAppConfig();
  return (
    <Screen title="Objetos prohibidos" subtitle="Lo que no se puede enviar con WannaSend.">
      <Card style={{ gap: 14 }}>
        {PROHIBIDOS.map((p) => (
          <Row key={p.title} gap={10} style={{ alignItems: 'flex-start' }}>
            <Ionicons name="close-circle" size={20} color={colors.danger} style={{ marginTop: 1 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Body>{p.title}</Body>
              {p.text ? <Small>{p.text}</Small> : null}
            </View>
          </Row>
        ))}
      </Card>
      <Card>
        <H3>El paquete se revisa al recogerlo</H3>
        <Muted>El carrier verá el contenido al recogerlo y lo comparará con la foto. Ciérralo delante de él. Si no coincide con lo declarado o no se puede mostrar, puede rechazarlo y te devolvemos el dinero.</Muted>
      </Card>
      <Card>
        <H3>Comida</H3>
        <Muted>Se puede enviar. Acuerda con el carrier cómo va (por ejemplo, en una bolsa isotérmica). Tú eres responsable de que vaya bien envasada y conservada.</Muted>
      </Card>
      <InfoBox icon="shield-outline" tone="amber">WannaSend no asegura el contenido de los paquetes. No envíes nada que no puedas permitirte perder.</InfoBox>
      {cfg?.prohibitedListVersion ? <Small style={{ textAlign: 'center' }}>Versión de la lista: {cfg.prohibitedListVersion}</Small> : null}
    </Screen>
  );
}
